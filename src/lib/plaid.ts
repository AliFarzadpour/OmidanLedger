'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { 
  PlaidApi, 
  Configuration, 
  PlaidEnvironments, 
  Transaction as PlaidTransaction 
} from 'plaid';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getApps, initializeApp } from 'firebase-admin/app';

// --- INITIALIZATION ---
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

// --- HELPER: Clean Text (NEW) ---
// Converts "LOAN_PAYMENTS" -> "Loan Payments"
function formatCategory(raw: string | undefined): string {
  if (!raw) return '';
  return raw
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// --- FLOWS ---

const CreateLinkTokenInputSchema = z.object({ userId: z.string() });
export async function createLinkToken(input: z.infer<typeof CreateLinkTokenInputSchema>): Promise<string> {
  return createLinkTokenFlow(input);
}
const createLinkTokenFlow = ai.defineFlow(
  { name: 'createLinkTokenFlow', inputSchema: CreateLinkTokenInputSchema, outputSchema: z.string() },
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
      throw new Error('Failed to create link token');
    }
  }
);

const ExchangePublicTokenInputSchema = z.object({ publicToken: z.string() });
export async function exchangePublicToken(input: z.infer<typeof ExchangePublicTokenInputSchema>): Promise<{ accessToken: string; itemId: string; }> {
  return exchangePublicTokenFlow(input);
}
const exchangePublicTokenFlow = ai.defineFlow(
  { name: 'exchangePublicTokenFlow', inputSchema: ExchangePublicTokenInputSchema, outputSchema: z.object({ accessToken: z.string(), itemId: z.string() }) },
  async ({ publicToken }) => {
    const plaidClient = getPlaidClient();
    try {
      const response = await plaidClient.itemPublicTokenExchange({ public_token: publicToken });
      return { accessToken: response.data.access_token, itemId: response.data.item_id };
    } catch (error: any) {
      throw new Error('Failed to exchange public token');
    }
  }
);

const CreateBankAccountInputSchema = z.object({ userId: z.string(), accessToken: z.string(), metadata: z.any() });
export async function createBankAccountFromPlaid(input: z.infer<typeof CreateBankAccountInputSchema>): Promise<void> {
  await createBankAccountFromPlaidFlow(input);
}
const createBankAccountFromPlaidFlow = ai.defineFlow(
  { name: 'createBankAccountFromPlaidFlow', inputSchema: CreateBankAccountInputSchema, outputSchema: z.void() },
  async ({ userId, accessToken, metadata }) => {
    const db = getAdminDB(); 
    const plaidClient = getPlaidClient();
    try {
      const accountsResponse = await plaidClient.accountsGet({ access_token: accessToken });
      const selectedAccountId = metadata?.account?.id || accountsResponse.data.accounts[0]?.account_id;
      const institutionName = metadata?.institution?.name || 'Unknown Bank';
      if (!selectedAccountId) throw new Error('No Account ID found.');
      const accountData = accountsResponse.data.accounts.find(acc => acc.account_id === selectedAccountId);
      if (!accountData) throw new Error('Account data not found.');

      const newAccount = {
        userId,
        plaidAccessToken: accessToken,
        plaidItemId: accountsResponse.data.item.item_id,
        plaidAccountId: accountData.account_id,
        accountName: accountData.name,
        accountType: accountData.subtype || 'other',
        bankName: institutionName,
        accountNumber: accountData.mask || 'N/A',
        plaidSyncCursor: null,
      };

      await db.collection('users').doc(userId).collection('bankAccounts').doc(accountData.account_id).set(newAccount, { merge: true });
    } catch (error: any) {
      throw new Error(`Failed to save bank account: ${error.message}`);
    }
  }
);

const SyncTransactionsInputSchema = z.object({ userId: z.string(), bankAccountId: z.string() });
export async function syncAndCategorizePlaidTransactions(input: z.infer<typeof SyncTransactionsInputSchema>): Promise<{ count: number }> {
  return syncAndCategorizePlaidTransactionsFlow(input);
}

// 👇 UPDATED SYNC FLOW WITH CATEGORY CLEANING
const syncAndCategorizePlaidTransactionsFlow = ai.defineFlow(
  {
    name: 'syncAndCategorizePlaidTransactionsFlow',
    inputSchema: SyncTransactionsInputSchema,
    outputSchema: z.object({ count: z.number() }),
  },
  async ({ userId, bankAccountId }) => {
    const db = getAdminDB();
    const plaidClient = getPlaidClient();

    try {
        const accountRef = db.collection('users').doc(userId).collection('bankAccounts').doc(bankAccountId);
        const accountSnap = await accountRef.get();
        if (!accountSnap.exists) throw new Error("Account not found");

        const data = accountSnap.data();
        const accessToken = data?.plaidAccessToken;
        let cursor = data?.plaidSyncCursor ?? undefined;

        if (!accessToken) throw new Error("No access token.");

        let allTransactions: PlaidTransaction[] = [];
        let hasMore = true;
        let loopCount = 0;

        // Fetch up to 5000 transactions (Current + Previous Year)
        while (hasMore && loopCount < 50) {
            loopCount++;
            const response = await plaidClient.transactionsSync({
                access_token: accessToken,
                cursor: cursor,
                count: 100,
            });
            const newData = response.data;
            allTransactions = allTransactions.concat(newData.added);
            hasMore = newData.has_more;
            cursor = newData.next_cursor;
        }

        // Filter: Start from Jan 1st of Previous Year (e.g., Jan 1, 2024 if today is 2025)
        const today = new Date();
        const targetYear = today.getFullYear() - 1; 
        const startDate = `${targetYear}-01-01`; 
        
        const relevantTransactions = allTransactions.filter(tx => tx.date >= startDate);

        if (relevantTransactions.length === 0) {
            await accountRef.update({ plaidSyncCursor: cursor });
            return { count: 0 };
        }

        const batch = db.batch();
        const transactionsRef = accountRef.collection('transactions');

        relevantTransactions.forEach((tx) => {
            const docRef = transactionsRef.doc(tx.transaction_id);
            
            // --- 🧹 CLEANING LOGIC START ---
            let primary = formatCategory(tx.personal_finance_category?.primary); // "Food And Drink"
            let secondary = formatCategory(tx.personal_finance_category?.detailed); // "Food And Drink Fast Food"
            
            // Remove redundancy: "Food And Drink Fast Food" -> "Fast Food"
            if (secondary.startsWith(primary)) {
                secondary = secondary.replace(primary, '').trim();
            }
            if (!secondary) secondary = 'General'; // Fallback if empty
            // --- CLEANING LOGIC END ---

            batch.set(docRef, {
                date: tx.date,
                description: tx.name,
                amount: tx.amount * -1,
                merchantName: tx.merchant_name || tx.name,
                
                // Use the Cleaned Categories
                primaryCategory: primary || 'Uncategorized',
                secondaryCategory: secondary,
                subcategory: secondary, // Fill subcategory so it's not empty in UI
                
                plaidTransactionId: tx.transaction_id,
                bankAccountId: bankAccountId,
                userId: userId,
                status: 'pending_review',
                confidence: 0.5,
                createdAt: FieldValue.serverTimestamp()
            }, { merge: true });
        });

        await batch.commit();
        await accountRef.update({ plaidSyncCursor: cursor });
        return { count: relevantTransactions.length };

    } catch (error: any) {
        console.error("Sync Error:", error.response?.data || error);
        throw new Error(`Sync failed: ${error.message}`);
    }
  }
);
