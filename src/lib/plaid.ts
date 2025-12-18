'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { 
  PlaidApi, 
  Configuration, 
  PlaidEnvironments, 
  TransactionsSyncRequest, 
  Transaction as PlaidTransaction 
} from 'plaid';

// 👇 CHANGED: Import from firebase-admin, NOT firebase/firestore
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getApps, initializeApp } from 'firebase-admin/app';

// Helper to ensure Admin SDK is initialized
function getAdminDB() {
  if (!getApps().length) {
    initializeApp();
  }
  return getFirestore();
}

function getPlaidClient() {
  const { PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV } = process.env;
  if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
    throw new Error('Plaid credentials missing in .env');
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

// --- FLOWS ---

const CreateLinkTokenInputSchema = z.object({
  userId: z.string(),
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
        user: { client_user_id: userId },
        client_name: 'FiscalFlow',
        products: ['transactions'],
        country_codes: ['US'],
        language: 'en',
      });
      return response.data.link_token;
    } catch (error: any) {
      console.error("Plaid Link Token Error:", error.response?.data || error);
      throw new Error('Failed to create link token');
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
    outputSchema: z.object({ accessToken: z.string(), itemId: z.string() }),
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
      console.error('Exchange Token Error:', error.response?.data || error);
      throw new Error('Failed to exchange public token');
    }
  }
);

const CreateBankAccountInputSchema = z.object({
  userId: z.string(),
  accessToken: z.string(),
  metadata: z.any(),
});

export async function createBankAccountFromPlaid(input: z.infer<typeof CreateBankAccountInputSchema>): Promise<void> {
  await createBankAccountFromPlaidFlow(input);
}

const createBankAccountFromPlaidFlow = ai.defineFlow(
    {
        name: 'createBankAccountFromPlaidFlow',
        inputSchema: CreateBankAccountInputSchema,
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
  bankAccountId: z.string(),
});

export async function syncAndCategorizePlaidTransactions(input: z.infer<typeof SyncTransactionsInputSchema>): Promise<{ count: number }> {
  return syncAndCategorizePlaidTransactionsFlow(input);
}

// 👇 REPLACE THE SYNC FLOW AT THE BOTTOM WITH THIS 👇
const syncAndCategorizePlaidTransactionsFlow = ai.defineFlow(
  {
    name: 'syncAndCategorizePlaidTransactionsFlow',
    inputSchema: SyncTransactionsInputSchema,
    outputSchema: z.object({ count: z.number() }),
  },
  async ({ userId, bankAccountId }) => {
    const db = getAdminDB();
    const plaidClient = getPlaidClient();

    console.log(`🔄 Syncing Plaid for User: ${userId}, Account: ${bankAccountId}`);

    try {
        // 1. Get Access Token from Firestore
        const accountRef = db.collection('users').doc(userId).collection('bankAccounts').doc(bankAccountId);
        const accountSnap = await accountRef.get();

        if (!accountSnap.exists) {
            throw new Error(`Bank account ${bankAccountId} not found in DB.`);
        }

        const data = accountSnap.data();
        const accessToken = data?.plaidAccessToken;
        
        // ⚠️ FIX: Plaid expects 'undefined' for empty cursors, NOT 'null'
        let cursor = data?.plaidSyncCursor ?? undefined; 

        if (!accessToken) throw new Error("No access token found for this account.");

        // 2. Fetch Transactions (Pagination Loop)
        let allTransactions: PlaidTransaction[] = [];
        let hasMore = true;

        // Safety: Limit loop to prevent infinite runs during dev
        let loopCount = 0;
        const MAX_LOOPS = 5; 

        while (hasMore && loopCount < MAX_LOOPS) {
            loopCount++;
            const response = await plaidClient.transactionsSync({
                access_token: accessToken,
                cursor: cursor,
                count: 100, // Max per page
                options: { 
                    include_personal_finance_category: true, // Help AI with categories
                }
            });

            const newData = response.data;
            allTransactions = allTransactions.concat(newData.added);
            
            // Update cursor and loop status
            hasMore = newData.has_more;
            cursor = newData.next_cursor;
        }

        console.log(`📥 Fetched ${allTransactions.length} new transactions.`);

        if (allTransactions.length === 0) {
            // Even if no transactions, update cursor so we don't check old history again
            await accountRef.update({ plaidSyncCursor: cursor });
            return { count: 0 };
        }

        // 3. Save Transactions (Batch Write)
        const batch = db.batch();
        const transactionsRef = accountRef.collection('transactions');

        allTransactions.forEach((tx) => {
            const docRef = transactionsRef.doc(tx.transaction_id);
            
            batch.set(docRef, {
                date: tx.date,
                description: tx.name,
                amount: tx.amount, // Positive = Expense, Negative = Income (Usually)
                merchantName: tx.merchant_name || tx.name,
                
                // Use Plaid's category if available as a fallback
                primaryCategory: tx.personal_finance_category?.primary || 'Uncategorized',
                secondaryCategory: tx.personal_finance_category?.detailed || '',
                subcategory: '', // AI will fill this later if we run categorization
                
                plaidTransactionId: tx.transaction_id,
                bankAccountId: bankAccountId,
                userId: userId,
                status: 'pending_review',
                confidence: 0.5, // Low confidence until AI reviews it
                createdAt: FieldValue.serverTimestamp()
            }, { merge: true });
        });

        await batch.commit();
        
        // Update cursor AFTER successful save
        await accountRef.update({ plaidSyncCursor: cursor });

        console.log("✅ Sync Complete.");
        return { count: allTransactions.length };

    } catch (error: any) {
        // Detailed Error Logging
        const plaidError = error.response?.data;
        console.error("🔴 Plaid Sync Failed:", plaidError || error.message);
        
        if (plaidError?.error_code === 'ITEM_LOGIN_REQUIRED') {
            throw new Error("Bank connection expired. Please reconnect your account.");
        }
        
        throw new Error(`Sync failed: ${plaidError?.error_message || error.message}`);
    }
  }
);
