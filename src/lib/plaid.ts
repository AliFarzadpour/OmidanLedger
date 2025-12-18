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

// --- 1. CONTEXT TYPES & LOADER ---

interface BusinessProfile {
  industry: 'Real Estate' | 'Construction' | 'Retail' | 'Consulting' | 'General';
  defaultIncomeCategory: string; 
}

interface UserContext {
  business: BusinessProfile;
  tenantNames: string[];
  vendorMap: Record<string, { category: string; subcategory: string }>;
  propertyAddresses: string[];
}

/**
 * Fetches User Settings, Tenants, Vendors, and Properties to give the AI context.
 */
async function fetchUserContext(db: FirebaseFirestore.Firestore, userId: string): Promise<UserContext> {
  // A. Fetch Business Settings (Defaults to General/Sales if missing)
  const settingsSnap = await db.doc(`users/${userId}/settings/business`).get();
  const settings = settingsSnap.data() || {};
  
  const business: BusinessProfile = {
    industry: settings.industry || 'General',
    defaultIncomeCategory: settings.defaultIncomeCategory || 'Sales / Service'
  };

  const context: UserContext = {
    business,
    tenantNames: [],
    vendorMap: {},
    propertyAddresses: []
  };

  // B. Fetch Tenants (for matching Rental Income)
  const tenantsSnap = await db.collection(`users/${userId}/tenants`).get();
  tenantsSnap.forEach(doc => {
    const data = doc.data();
    if (data.name) context.tenantNames.push(data.name.toUpperCase());
  });

  // C. Fetch Vendors (for matching Expenses)
  const vendorsSnap = await db.collection(`users/${userId}/vendors`).get();
  vendorsSnap.forEach(doc => {
    const data = doc.data();
    if (data.name) {
      context.vendorMap[data.name.toUpperCase()] = {
        category: data.defaultCategory || 'Operating Expenses',
        subcategory: data.defaultSubcategory || 'Uncategorized'
      };
    }
  });

  // D. Fetch Properties (for matching address-based expenses)
  const propertiesSnap = await db.collection(`users/${userId}/properties`).get();
  propertiesSnap.forEach(doc => {
    const data = doc.data();
    if (data.address) {
      const streetPart = data.address.split(',')[0].toUpperCase(); 
      context.propertyAddresses.push(streetPart);
    }
  });

  return context;
}

// --- 2. SMART CATEGORIZATION LOGIC ---

function categorizeWithContext(
  description: string, 
  amount: number, 
  plaidCategory: any,
  context: UserContext
): { primary: string, secondary: string, sub: string, confidence: number } {
  
  const desc = description.toUpperCase();
  const isIncome = amount > 0;
  const { industry, defaultIncomeCategory } = context.business;
  const rawPrimary = (plaidCategory?.primary || '').toUpperCase();

  // --- TIER 1: EXACT DATABASE MATCHES (Highest Confidence) ---
  
  // 1. Known Tenants (Income)
  if (isIncome) {
    const matchedTenant = context.tenantNames.find(name => desc.includes(name));
    if (matchedTenant) {
      return { 
        primary: 'Income', 
        secondary: 'Operating Income', 
        sub: defaultIncomeCategory, // e.g. "Rental Income"
        confidence: 0.95 
      };
    }
  }

  // 2. Known Vendors (Expense)
  if (!isIncome) {
    const matchedVendor = Object.keys(context.vendorMap).find(name => desc.includes(name));
    if (matchedVendor) {
      const mapping = context.vendorMap[matchedVendor];
      return {
        primary: 'Operating Expenses', 
        secondary: mapping.category,
        sub: mapping.subcategory,
        confidence: 0.95
      };
    }
  }

  // 3. Property Address Match (Expense)
  const matchedAddress = context.propertyAddresses.find(addr => desc.includes(addr));
  if (matchedAddress && !isIncome) {
     return {
        primary: 'Operating Expenses',
        secondary: 'Repairs & Maintenance',
        sub: 'General Maintenance',
        confidence: 0.7
     };
  }

  // --- TIER 2: INDUSTRY-SPECIFIC HEURISTICS ---

  // 4. Material/Supply Stores
  if (!isIncome && (desc.includes('HOME DEPOT') || desc.includes('LOWES') || desc.includes('MENARDS'))) {
     if (industry === 'Construction' || industry === 'Real Estate') {
        return { primary: 'Cost of Goods Sold', secondary: 'Materials', sub: 'Job Supplies', confidence: 0.8 };
     } else {
        return { primary: 'Operating Expenses', secondary: 'Repairs & Maintenance', sub: 'Building Supplies', confidence: 0.7 };
     }
  }

  // 5. Software/Tech
  if (!isIncome && (desc.includes('ADOBE') || desc.includes('GOOGLE') || desc.includes('AWS'))) {
     return { primary: 'Operating Expenses', secondary: 'General & Administrative', sub: 'Software & Subscriptions', confidence: 0.85 };
  }

  // 6. Taxes & Gov
  if (desc.includes('IRS') || desc.includes('TAX') || desc.includes('COLLIN COUNTY') || desc.includes('USATAXPYMT')) {
     return { primary: 'Operating Expenses', secondary: 'Taxes & Licenses', sub: 'Tax Payment', confidence: 0.9 };
  }

  // --- TIER 3: SMART FALLBACKS ---

  // 7. Zelle / Transfers
  if (desc.includes('ZELLE') || desc.includes('TRANSFER')) {
      if (isIncome) {
          // If Real Estate, Zelle is likely Rent.
          return { 
              primary: 'Income', 
              secondary: 'Operating Income', 
              sub: defaultIncomeCategory, 
              confidence: 0.6 
          };
      } else {
          // Zelle Out is usually a Contractor or Owner Draw
          return { 
              primary: 'Operating Expenses', 
              secondary: 'Uncategorized', 
              sub: 'Contractor or Draw?', 
              confidence: 0.4 
          };
      }
  }

  // 8. Loans / Liabilities
  if (desc.includes('LOAN') || desc.includes('MORTGAGE') || rawPrimary === 'LOAN_PAYMENTS' || desc.includes('CREDIT CARD') || desc.includes('BILL PAY')) {
      return { primary: 'Balance Sheet', secondary: 'Liabilities', sub: 'Loan/Card Payment', confidence: 0.8 };
  }

  // --- TIER 4: DEFAULT ---
  return { 
      primary: 'Operating Expenses', 
      secondary: 'Uncategorized', 
      sub: 'General Expense', 
      confidence: 0.1 
  };
}

// --- 3. MAIN SYNC FLOW ---

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

        // 1. Fetch User Context for Smart Categorization
        const userContext = await fetchUserContext(db, userId);

        let allTransactions: PlaidTransaction[] = [];
        let hasMore = true;
        let loopCount = 0;

        // 2. Fetch from Plaid
        while (hasMore && loopCount < 50) {
            loopCount++;
            const response = await plaidClient.transactionsSync({
                access_token: accessToken,
                cursor: cursor,
                count: 500, // Maximize batch size
            });
            const newData = response.data;
            allTransactions = allTransactions.concat(newData.added);
            hasMore = newData.has_more;
            cursor = newData.next_cursor;
        }

        // 3. Filter for 2025 ONLY
        const STRICT_START_DATE = '2025-01-01'; 
        
        const relevantTransactions = allTransactions.filter(tx => {
            const isNewEnough = tx.date >= STRICT_START_DATE;
            const isCurrentAccount = tx.account_id === bankAccountId;
            return isNewEnough && isCurrentAccount;
        });

        if (relevantTransactions.length === 0) {
            // Update cursor even if empty so we don't re-scan next time
            await accountRef.update({ 
                plaidSyncCursor: cursor,
                historicalDataPending: false,
                lastSyncedAt: FieldValue.serverTimestamp()
            });
            return { count: 0 };
        }

        // 4. Batch Save with Smart Categorization
        // Firestore batch limit is 500. If you have more, you might need to chunk this loop.
        const batch = db.batch();

        relevantTransactions.forEach((tx) => {
            const transactionAccountRef = db.collection('users').doc(userId).collection('bankAccounts').doc(tx.account_id);
            const docRef = transactionAccountRef.collection('transactions').doc(tx.transaction_id);
            
            // Invert Amount: Plaid sends Positive for Expense. We want Negative for Expense.
            const signedAmount = tx.amount * -1; 

            // RUN SMART CATEGORIZATION
            const smartCategory = categorizeWithContext(
                tx.name,
                signedAmount,
                tx.personal_finance_category,
                userContext
            );

            batch.set(docRef, {
                date: tx.date,
                description: tx.name,
                amount: signedAmount,
                merchantName: tx.merchant_name || tx.name,
                primaryCategory: smartCategory.primary,
                secondaryCategory: smartCategory.secondary,
                subcategory: smartCategory.sub,
                confidence: smartCategory.confidence,
                plaidTransactionId: tx.transaction_id,
                bankAccountId: tx.account_id,
                userId: userId,
                status: 'pending_review',
                createdAt: FieldValue.serverTimestamp()
            }, { merge: true });
        });

        await batch.commit();
        
        // 5. Finalize Update
        await accountRef.update({ 
            plaidSyncCursor: cursor,
            historicalDataPending: false,
            lastSyncedAt: FieldValue.serverTimestamp()
        });

        return { count: relevantTransactions.length };

    } catch (error: any) {
        console.error("Sync Error:", error.response?.data || error);
        throw new Error(`Sync failed: ${error.message}`);
    }
  }
);
// ---PLAID FLOWS
const CreateLinkTokenInputSchema = z.object({
    userId: z.string(),
    daysRequested: z.number().optional(),
  });
  export async function createLinkToken(input: z.infer<typeof CreateLinkTokenInputSchema>): Promise<string> {
    return createLinkTokenFlow(input);
  }
  const createLinkTokenFlow = ai.defineFlow(
    { name: 'createLinkTokenFlow', inputSchema: CreateLinkTokenInputSchema, outputSchema: z.string() },
    async ({ userId, daysRequested }) => {
      const plaidClient = getPlaidClient();
      
      const finalDays = daysRequested || 90;
  
      try {
        const response = await plaidClient.linkTokenCreate({
          user: { client_user_id: userId },
          client_name: 'FiscalFlow',
          products: ['transactions'],
          country_codes: ['US'],
          language: 'en',
          transactions: {
            days_requested: finalDays
          }
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
      const batch = db.batch();
  
      try {
        const accountsResponse = await plaidClient.accountsGet({ access_token: accessToken });
        if (!accountsResponse.data.accounts || accountsResponse.data.accounts.length === 0) {
          throw new Error('No accounts found for this Plaid item.');
        }
        const institutionName = metadata?.institution?.name || 'Unknown Bank';
  
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
            plaidSyncCursor: null,
            historicalDataPending: true, // <--- DEFAULT TO TRUE
            lastSyncedAt: FieldValue.serverTimestamp()
          };
          const accountDocRef = db.collection('users').doc(userId).collection('bankAccounts').doc(accountData.account_id);
          batch.set(accountDocRef, newAccount, { merge: true });
        });
  
        await batch.commit();
  
      } catch (error: any) {
        console.error('Create Bank Account Flow Error:', error.response?.data || error);
        throw new Error(`Failed to save bank accounts: ${error.message}`);
      }
    }
  );
  
  
  
  

