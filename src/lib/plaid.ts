
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

// 👇 FIXED FUNCTION: Uses Admin SDK Syntax
const createBankAccountFromPlaidFlow = ai.defineFlow(
  {
    name: 'createBankAccountFromPlaidFlow',
    inputSchema: CreateBankAccountInputSchema,
    outputSchema: z.void(),
  },
  async ({ userId, accessToken, metadata }) => {
    const db = getAdminDB(); // Use Admin DB
    const plaidClient = getPlaidClient();

    console.log("Creating Bank Account. Metadata:", JSON.stringify(metadata));

    try {
      // 1. Fetch real account data from Plaid to be safe
      const accountsResponse = await plaidClient.accountsGet({
        access_token: accessToken,
      });

      // 2. Determine which account to save
      // Prefer the ID from metadata, fallback to the first one found
      const selectedAccountId = metadata?.account?.id || accountsResponse.data.accounts[0]?.account_id;
      const institutionName = metadata?.institution?.name || 'Unknown Bank';

      if (!selectedAccountId) throw new Error('No Account ID found.');

      const accountData = accountsResponse.data.accounts.find(acc => acc.account_id === selectedAccountId);
      if (!accountData) throw new Error('Account data not found in Plaid response.');

      // 3. Prepare Data
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

      // 4. Save using ADMIN syntax (db.doc().set())
      // Note: No "doc(db, ...)" wrapper needed here
      await db
        .collection('users')
        .doc(userId)
        .collection('bankAccounts')
        .doc(accountData.account_id)
        .set(newAccount, { merge: true });
        
      console.log("✅ Bank Account Saved Successfully");

    } catch (error: any) {
      console.error('Create Bank Account Error:', error.response?.data || error);
      throw new Error(`Failed to save bank account: ${error.message}`);
    }
  }
);

const SyncTransactionsInputSchema = z.object({
  userId: z.string(),
  bankAccountId: z.string(),
});

export async function syncAndCategorizePlaidTransactions(input: z.infer<typeof SyncTransactionsInputSchema>): Promise<{ count: number }> {
  return syncAndCategorizePlaidTransactionsFlow(input);
}

// 👇 FIXED FUNCTION: Uses Admin SDK Syntax
const syncAndCategorizePlaidTransactionsFlow = ai.defineFlow(
  {
    name: 'syncAndCategorizePlaidTransactionsFlow',
    inputSchema: SyncTransactionsInputSchema,
    outputSchema: z.object({ count: z.number() }),
  },
  async ({ userId, bankAccountId }) => {
    const db = getAdminDB();
    const plaidClient = getPlaidClient();

    // 1. Get Access Token
    const accountRef = db.collection('users').doc(userId).collection('bankAccounts').doc(bankAccountId);
    const accountSnap = await accountRef.get(); // Admin SDK uses .get(), not getDoc()

    if (!accountSnap.exists) {
      throw new Error("Bank account not found in DB.");
    }

    const data = accountSnap.data();
    const accessToken = data?.plaidAccessToken;
    let cursor = data?.plaidSyncCursor || null;

    if (!accessToken) throw new Error("No access token found.");

    // 2. Fetch Transactions (Pagination)
    let allTransactions: PlaidTransaction[] = [];
    let hasMore = true;

    while (hasMore) {
      const response = await plaidClient.transactionsSync({
        access_token: accessToken,
        cursor: cursor,
        count: 100,
        options: { account_ids: [bankAccountId] }
      });

      allTransactions = allTransactions.concat(response.data.added);
      hasMore = response.data.has_more;
      cursor = response.data.next_cursor;
    }

    if (allTransactions.length === 0) {
      await accountRef.update({ plaidSyncCursor: cursor });
      return { count: 0 };
    }

    // 3. Save Transactions (Batch)
    const batch = db.batch();
    const transactionsRef = accountRef.collection('transactions');

    allTransactions.forEach((tx) => {
      const docRef = transactionsRef.doc(tx.transaction_id);
      batch.set(docRef, {
        date: tx.date,
        description: tx.name,
        amount: tx.amount,
        merchantName: tx.merchant_name || tx.name,
        category: tx.category ? tx.category[0] : 'Uncategorized',
        plaidTransactionId: tx.transaction_id,
        bankAccountId: bankAccountId,
        userId: userId,
        status: 'pending_review' // Default status
      }, { merge: true });
    });

    await batch.commit();
    await accountRef.update({ plaidSyncCursor: cursor });

    return { count: allTransactions.length };
  }
);
