'use server';
/**
 * @fileOverview AI flows for interacting with the Plaid API.
 * - createLinkToken: Creates a link_token required to initialize Plaid Link.
 * - exchangePublicToken: Exchanges a public_token for an access_token.
 * - createBankAccountFromPlaid: Creates a bank account record in Firestore from Plaid data.
 * - syncAndCategorizePlaidTransactions: Fetches, categorizes, and saves transactions from Plaid.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { PlaidApi, Configuration, PlaidEnvironments, TransactionsSyncRequest, RemovedTransaction, Transaction as PlaidTransaction } from 'plaid';
import { initializeServerFirebase, getUserCategoryMappings } from '@/ai/utils';
import { collection, doc, getDoc, writeBatch, setDoc, updateDoc } from 'firebase/firestore';
import { categorizeTransactionsFromStatement } from './categorize-transactions-from-statement';

function getPlaidClient() {
  const { PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV } = process.env;

  if (!PLAID_CLIENT_ID || PLAID_CLIENT_ID === 'YOUR_PLAID_CLIENT_ID') {
    throw new Error(
      'Plaid integration is not configured. Please add your PLAID_CLIENT_ID from your Plaid dashboard to the .env file.'
    );
  }
   if (!PLAID_SECRET || PLAID_SECRET === 'YOUR_PLAID_SECRET') {
    throw new Error(
      'Plaid integration is not configured. Please add your PLAID_SECRET from your Plaid dashboard to the .env file.'
    );
  }

  const plaidConfig = new Configuration({
    basePath: PlaidEnvironments[PLAID_ENV || 'sandbox'],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
        'PLAID-SECRET': PLAID_SECRET,
      },
    },
  });

  return new PlaidApi(plaidConfig);
}

const CreateLinkTokenInputSchema = z.object({
  userId: z.string().describe('The unique identifier for the user.'),
});

export async function createLinkToken(input: z.infer<typeof CreateLinkTokenInputSchema>): Promise<string> {
  return createLinkTokenFlow(input);
}

const createLinkTokenFlow = ai.defineFlow(
  {
    name: 'createLinkTokenFlow',
    inputSchema: CreateLinkTokenInputSchema,
    outputSchema: z.string(),
  },
  async ({ userId }) => {
    const plaidClient = getPlaidClient();
    try {
      const response = await plaidClient.linkTokenCreate({
        user: {
          client_user_id: userId,
        },
        client_name: 'FiscalFlow',
        products: ['transactions'],
        country_codes: ['US'],
        language: 'en',
      });
      return response.data.link_token;
    } catch (error: any) {
      console.error("Error creating Plaid link token:", error.response?.data || error.message);
      const errorMessage = error.response?.data?.error_message || error.message || 'Could not create Plaid link token.';
      throw new Error(errorMessage);
    }
  }
);


const ExchangePublicTokenInputSchema = z.object({
  publicToken: z.string(),
});

export async function exchangePublicToken(input: z.infer<typeof ExchangePublicTokenInputSchema>): Promise<{ accessToken: string; itemId: string; }> {
    return exchangePublicTokenFlow(input);
}

const exchangePublicTokenFlow = ai.defineFlow(
    {
        name: 'exchangePublicTokenFlow',
        inputSchema: ExchangePublicTokenInputSchema,
        outputSchema: z.object({
            accessToken: z.string(),
            itemId: z.string(),
        }),
    },
    async ({ publicToken }) => {
        const plaidClient = getPlaidClient();
        try {
            const response = await plaidClient.itemPublicTokenExchange({
                public_token: publicToken,
            });
            return {
                accessToken: response.data.access_token,
                itemId: response.data.item_id,
            };
        } catch (error: any) {
            console.error('Error exchanging public token:', error.response?.data || error.message);
            throw new Error('Could not exchange public token.');
        }
    }
);


const CreateBankAccountFromPlaidInputSchema = z.object({
    userId: z.string(),
    accessToken: z.string(),
    metadata: z.any(),
});

export async function createBankAccountFromPlaid(input: z.infer<typeof CreateBankAccountFromPlaidInputSchema>): Promise<void> {
    await createBankAccountFromPlaidFlow(input);
}

const createBankAccountFromPlaidFlow = ai.defineFlow(
    {
        name: 'createBankAccountFromPlaidFlow',
        inputSchema: CreateBankAccountFromPlaidInputSchema,
        outputSchema: z.void(),
    },
    async ({ userId, accessToken, metadata }) => {
        const { firestore } = initializeServerFirebase();
        const plaidClient = getPlaidClient();

        console.log("🔍 Debug: Metadata received:", JSON.stringify(metadata, null, 2));

        try {
            // 1. Get account details from Plaid
            const accountsResponse = await plaidClient.accountsGet({
                access_token: accessToken,
            });
            
            // 2. Safely extract metadata (Prevents "Cannot read property of undefined" crashes)
            // If metadata.account is missing, default to the first account in the response
            const selectedAccountId = metadata?.account?.id || accountsResponse.data.accounts[0]?.account_id;
            const institutionName = metadata?.institution?.name || 'Unknown Bank';

            if (!selectedAccountId) {
                throw new Error('No account ID found in Metadata or Plaid Response.');
            }

            // 3. Find the specific account details
            const accountData = accountsResponse.data.accounts.find(acc => acc.account_id === selectedAccountId);

            if (!accountData) {
                throw new Error(`Account with ID ${selectedAccountId} not found in Plaid response.`);
            }

            const newAccount = {
                userId,
                plaidAccessToken: accessToken,
                plaidItemId: accountsResponse.data.item.item_id,
                plaidAccountId: accountData.account_id,
                accountName: accountData.name,
                accountType: accountData.subtype || 'other',
                bankName: institutionName, 
                accountNumber: accountData.mask || 'N/A', // Handle null masks safely
                plaidSyncCursor: null, 
            };
            
            console.log("💾 Saving to Firestore:", newAccount);

            // 4. Save to Firestore
            const bankAccountRef = doc(firestore, `users/${userId}/bankAccounts`, accountData.account_id);
            await setDoc(bankAccountRef, newAccount, { merge: true });

        } catch (error: any) {
            // Log the REAL error to the server console
            console.error('🔴 DETAILED ERROR:', error.response?.data || error.message || error);
            
            // Re-throw a message that might actually help the UI
            throw new Error(`Failed to save account: ${error.message}`);
        }
    });

const SyncTransactionsInputSchema = z.object({
  userId: z.string(),
  bankAccountId: z.string(), // This will be the Firestore document ID, which is the Plaid Account ID
});


export async function syncAndCategorizePlaidTransactions(input: z.infer<typeof SyncTransactionsInputSchema>): Promise<{ count: number }> {
    return syncAndCategorizePlaidTransactionsFlow(input);
}

const syncAndCategorizePlaidTransactionsFlow = ai.defineFlow(
  {
    name: 'syncAndCategorizePlaidTransactionsFlow',
    inputSchema: SyncTransactionsInputSchema,
    outputSchema: z.object({ count: z.number() }),
  },
  async ({ userId, bankAccountId }) => {
    const { firestore } = initializeServerFirebase();
    const plaidClient = getPlaidClient();

    const bankAccountRef = doc(firestore, `users/${userId}/bankAccounts`, bankAccountId);
    const bankAccountSnap = await getDoc(bankAccountRef);

    if (!bankAccountSnap.exists()) {
      throw new Error("Bank account not found.");
    }
    const bankAccountData = bankAccountSnap.data();
    const accessToken = bankAccountData.plaidAccessToken;
    let cursor = bankAccountData.plaidSyncCursor;

    if (!accessToken) {
      throw new Error("Plaid access token not found for this account.");
    }

    let allTransactions: PlaidTransaction[] = [];
    let hasMore = true;

    while (hasMore) {
      const request: TransactionsSyncRequest = {
        access_token: accessToken,
        cursor: cursor,
        count: 100,
        options: {
            account_ids: [bankAccountId]
        }
      };
      const response = await plaidClient.transactionsSync(request);
      const data = response.data;
      
      allTransactions = allTransactions.concat(data.added);
      
      hasMore = data.has_more;
      cursor = data.next_cursor;
    }

    if (allTransactions.length === 0) {
        await updateDoc(bankAccountRef, { plaidSyncCursor: cursor });
        return { count: 0 };
    }
    
    const transactionText = allTransactions.map(t => `${t.date},${t.name},${t.amount}`).join('\n');
    const fakeCsvDataUri = `data:text/csv;base64,${Buffer.from(transactionText).toString('base64')}`;
    
    const userMappings = await getUserCategoryMappings(firestore, userId);

    const categorizationResult = await categorizeTransactionsFromStatement({
      statementDataUri: fakeCsvDataUri,
      userId: userId,
      userMappings: userMappings,
    });
    
    const categorizedTransactions = categorizationResult.transactions;
    
    const batch = writeBatch(firestore);
    const transactionsColRef = collection(firestore, `users/${userId}/bankAccounts/${bankAccountId}/transactions`);
    
    categorizedTransactions.forEach((tx) => {
        const originalPlaidTx = allTransactions.find(ptx => ptx.name === tx.description && ptx.amount === tx.amount);
        const docId = originalPlaidTx?.transaction_id || doc(transactionsColRef).id;
        const newTransactionDoc = doc(transactionsColRef, docId);

        batch.set(newTransactionDoc, {
            ...tx,
            bankAccountId: bankAccountId,
            userId: userId,
        });
    });

    await batch.commit();

    await updateDoc(bankAccountRef, { plaidSyncCursor: cursor });

    return { count: categorizedTransactions.length };
  }
);
