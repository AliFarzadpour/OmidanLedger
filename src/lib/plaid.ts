
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

// --- SMART MAPPING: Plaid -> Accountant ---
function mapPlaidToBusinessCategory(plaidPrimary: string | undefined, plaidDetailed: string | undefined, description: string): { primary: string, secondary: string, sub: string } {
  const rawDetailed = (plaidDetailed || '').toUpperCase();
  const rawPrimary = (plaidPrimary || '').toUpperCase();
  const desc = description.toUpperCase();

  if (rawPrimary === 'INCOME' || rawDetailed.includes('DIVIDENDS') || rawDetailed.includes('INTEREST')) {
    if (rawDetailed.includes('INTEREST')) return { primary: 'Income', secondary: 'Non-Operating Income', sub: 'Interest Income' };
    return { primary: 'Income', secondary: 'Operating Income', sub: 'Sales / Service' };
  }

  if (desc.includes('UBER') || desc.includes('LYFT')) {
    return { primary: 'Operating Expenses', secondary: 'Vehicle & Travel', sub: 'Taxis & Rideshare' };
  }
  if (desc.includes('AIRLINES') || desc.includes('HOTEL') || desc.includes('AIRBNB')) {
    return { primary: 'Operating Expenses', secondary: 'Vehicle & Travel', sub: 'Travel' };
  }
  if (desc.includes('EDISON') || desc.includes('WATER') || desc.includes('PG&E') || desc.includes('ENERGY')) {
    return { primary: 'Operating Expenses', secondary: 'General & Administrative', sub: 'Utilities' };
  }

  if (rawPrimary === 'RENT_AND_UTILITIES') {
     return { primary: 'Operating Expenses', secondary: 'General & Administrative', sub: 'Rent & Utilities' };
  }
  
  if (rawPrimary === 'FOOD_AND_DRINK') {
     return { primary: 'Operating Expenses', secondary: 'Meals & Entertainment', sub: 'Meals' };
  }

  if (rawPrimary === 'TRANSPORTATION') {
     if (rawDetailed.includes('GAS') || rawDetailed.includes('FUEL')) {
        return { primary: 'Operating Expenses', secondary: 'Vehicle & Travel', sub: 'Fuel' };
     }
     return { primary: 'Operating Expenses', secondary: 'Vehicle & Travel', sub: 'General Transport' };
  }

  if (rawPrimary === 'LOAN_PAYMENTS') {
     return { primary: 'Balance Sheet', secondary: 'Liabilities', sub: 'Loan Payment' };
  }

  if (rawPrimary === 'TRANSFER_IN' || rawPrimary === 'TRANSFER_OUT') {
     return { primary: 'Balance Sheet', secondary: 'Transfers', sub: 'Internal Transfer' };
  }

  const cleanSub = rawDetailed.split('_').pop() || 'General'; 
  const formattedSub = cleanSub.charAt(0).toUpperCase() + cleanSub.slice(1).toLowerCase();
  
  return { 
      primary: 'Operating Expenses',
      secondary: 'Uncategorized', 
      sub: formattedSub 
  };
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
// 👇 FIXED: This flow now iterates over all accounts.
const createBankAccountFromPlaidFlow = ai.defineFlow(
  {
    name: 'createBankAccountFromPlaidFlow',
    inputSchema: CreateBankAccountInputSchema,
    outputSchema: z.void(),
  },
  async ({ userId, accessToken, metadata }) => {
    const db = getAdminDB(); 
    const plaidClient = getPlaidClient();
    const batch = db.batch(); // Use a batch for atomic writes

    try {
      // 1. Fetch all accounts associated with the Item
      const accountsResponse = await plaidClient.accountsGet({
        access_token: accessToken,
      });

      if (!accountsResponse.data.accounts || accountsResponse.data.accounts.length === 0) {
        throw new Error('No accounts found for this Plaid item.');
      }
      
      const institutionName = metadata?.institution?.name || 'Unknown Bank';

      // 2. Loop through every account returned by Plaid
      accountsResponse.data.accounts.forEach(accountData => {
        const newAccount = {
          userId,
          plaidAccessToken: accessToken,
          plaidItemId: accountsResponse.data.item.item_id,
          plaidAccountId: accountData.account_id,
          accountName: accountData.name,
          accountType: accountData.subtype || 'other',
          bankName: institutionName,
          accountNumber: accountData.mask || 'N/A',
          plaidSyncCursor: null, // Start with a null cursor for the first sync
        };
        
        // Add a "set" operation to the batch for each account
        const accountDocRef = db.collection('users').doc(userId).collection('bankAccounts').doc(accountData.account_id);
        batch.set(accountDocRef, newAccount, { merge: true });
      });

      // 3. Commit the batch to save all accounts at once
      await batch.commit();

    } catch (error: any) {
      console.error('Create Bank Account Flow Error:', error.response?.data || error);
      throw new Error(`Failed to save bank accounts: ${error.message}`);
    }
  }
);


const SyncTransactionsInputSchema = z.object({ userId: z.string(), bankAccountId: z.string() });
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
            
            const smartCategory = mapPlaidToBusinessCategory(
                tx.personal_finance_category?.primary,
                tx.personal_finance_category?.detailed,
                tx.name
            );

            batch.set(docRef, {
                date: tx.date,
                description: tx.name,
                amount: tx.amount * -1,
                merchantName: tx.merchant_name || tx.name,
                
                primaryCategory: smartCategory.primary,
                secondaryCategory: smartCategory.secondary,
                subcategory: smartCategory.sub,
                
                plaidTransactionId: tx.transaction_id,
                bankAccountId: bankAccountId,
                userId: userId,
                status: 'pending_review',
                confidence: 0.8,
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

    