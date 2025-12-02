'use server';
/**
 * @fileOverview AI flows for interacting with the Plaid API.
 * - createLinkToken: Creates a link_token required to initialize Plaid Link.
 * - exchangePublicToken: Exchanges a public_token for an access_token.
 * - createBankAccountFromPlaid: Creates a bank account record in Firestore from Plaid data.
 * - syncAndCategorizePlaidTransactions: Fetches, categorizes, and saves transactions from Plaid.
 */
import { config } from 'dotenv';
config();

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { PlaidApi, Configuration, PlaidEnvironments, TransactionsSyncRequest, RemovedTransaction, Transaction as PlaidTransaction } from 'plaid';
import { addDocumentNonBlocking, setDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { initializeServerFirebase, getUserCategoryMappings } from '@/ai/utils';
import { collection, doc, getDoc, writeBatch } from 'firebase/firestore';
import { categorizeTransactionsFromStatement } from './categorize-transactions-from-statement';

function getPlaidClient() {
  const { PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV } = process.env;

  if (!PLAID_CLIENT_ID || PLAID_CLIENT_ID === 'YOUR_PLAID_CLIENT_ID') {
    throw new Error(
      'Plaid integration is not configured. Please add your PLAID_CLIENT_ID to the .env file.'
    );
  }
   if (!PLAID_SECRET || PLAID_SECRET === 'YOUR_PLAID_SECRET') {
    throw new Error(
      'Plaid integration is not configured. Please add your PLAID_SECRET to the .env file.'
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
        redirect_uri: 'http://localhost/', // Add this to bypass the phone number screen
        transactions: {
            days_requested: 30,
        }
      });
      return response.data.link_token;
    } catch (error: any) {
      console.error("Error creating Plaid link token:", error.response?.data || error.message);
      throw new Error('Could not create Plaid link token.');
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

        try {
            // Get account details from Plaid
            const accountsResponse = await plaidClient.accountsGet({
                access_token: accessToken,
            });
            const accountData = accountsResponse.data.accounts.find(acc => acc.account_id === metadata.account_id);

            if (!accountData) {
                throw new Error(`Account with ID ${metadata.account_id} not found in Plaid response.`);
            }

            const newAccount = {
                userId,
                plaidAccessToken: accessToken,
                plaidItemId: accountsResponse.data.item.item_id,
                plaidAccountId: accountData.account_id,
                accountName: accountData.name,
                accountType: accountData.subtype || 'other',
                bankName: metadata.institution.name,
                accountNumber: accountData.mask,
                plaidSyncCursor: null, // Initialize sync cursor
            };
            
            // Plaid can return multiple accounts for a single item. We need to create a document for each.
            // However, the metadata only contains one account. We will create just that one.
            // The Plaid item ID is the same for all accounts associated with a single login.
            // The account ID is unique for each account. We'll use Plaid's account ID as our doc ID.
            const bankAccountRef = doc(firestore, `users/${userId}/bankAccounts`, accountData.account_id);

            // Note: We are not using a blocking call here.
            setDocumentNonBlocking(bankAccountRef, newAccount, { merge: true });

        } catch (error: any) {
            console.error('Error creating bank account from Plaid:', error.response?.data || error.message);
            throw new Error('Could not create bank account from Plaid data.');
        }
    }
);

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
        // Limit the number of transactions to fetch per page to stay within API limits
        count: 100,
        // Filter by the specific account ID
        options: {
            account_ids: [bankAccountId]
        }
      };
      const response = await plaidClient.transactionsSync(request);
      const data = response.data;
      
      allTransactions = allTransactions.concat(data.added);
      // We don't handle modified or removed transactions in this implementation for simplicity
      
      hasMore = data.has_more;
      cursor = data.next_cursor;
    }

    if (allTransactions.length === 0) {
        // Still update the cursor even if there are no new transactions
        updateDocumentNonBlocking(bankAccountRef, { plaidSyncCursor: cursor });
        return { count: 0 };
    }
    
    // Create a text block of transactions to send to the categorization AI
    const transactionText = allTransactions.map(t => `${t.date},${t.name},${t.amount}`).join('\n');
    const fakeCsvDataUri = `data:text/csv;base64,${Buffer.from(transactionText).toString('base64')}`;
    
    // Get user's custom mappings
    const userMappings = await getUserCategoryMappings(firestore, userId);

    // Call the AI to categorize everything
    const categorizationResult = await categorizeTransactionsFromStatement({
      statementDataUri: fakeCsvDataUri,
      userId: userId,
      userMappings: userMappings,
    });
    
    const categorizedTransactions = categorizationResult.transactions;
    
    // Save categorized transactions to Firestore in a batch
    const batch = writeBatch(firestore);
    const transactionsColRef = collection(firestore, `users/${userId}/bankAccounts/${bankAccountId}/transactions`);
    
    // Match categorized transactions back to Plaid transactions to get the original ID
    categorizedTransactions.forEach((tx) => {
        const originalPlaidTx = allTransactions.find(ptx => ptx.name === tx.description && ptx.amount === tx.amount);
        const docId = originalPlaidTx?.transaction_id || doc(transactionsColRef).id; // Use Plaid ID if available, otherwise generate new one
        const newTransactionDoc = doc(transactionsColRef, docId);

        batch.set(newTransactionDoc, {
            ...tx,
            bankAccountId: bankAccountId,
            userId: userId,
        });
    });

    await batch.commit();

    // After successfully saving, update the sync cursor on the bank account
    updateDocumentNonBlocking(bankAccountRef, { plaidSyncCursor: cursor });

    return { count: categorizedTransactions.length };
  }
);
