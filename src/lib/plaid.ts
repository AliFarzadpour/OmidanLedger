
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
import { CATEGORIZATION_SYSTEM_PROMPT, BatchCategorizationSchema } from '@/lib/prompts/categorization';

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
  const settingsSnap = await db.doc(`users/${userId}`).get();
  const settings = settingsSnap.data() || {};
  
  const business: BusinessProfile = {
    industry: settings.trade || 'General',
    defaultIncomeCategory: 'Rental Income' // Assuming this is the main income for landlords
  };

  const context: UserContext = {
    business,
    tenantNames: [],
    vendorMap: {},
    propertyAddresses: []
  };

  // B. Fetch Tenants (for matching Rental Income)
  // This requires a collectionGroup query if tenants are nested under properties
  const propertiesSnapWithTenants = await db.collection(`properties`).where('userId', '==', userId).get();
  propertiesSnapWithTenants.forEach(doc => {
    const data = doc.data();
    if (data.tenants && Array.isArray(data.tenants)) {
        data.tenants.forEach((tenant: any) => {
            if (tenant.firstName && tenant.lastName) {
                context.tenantNames.push(`${tenant.firstName} ${tenant.lastName}`.toUpperCase());
            }
        });
    }
  });


  // C. Fetch Vendors (for matching Expenses)
  const vendorsSnap = await db.collection(`vendors`).where('userId', '==', userId).get();
  vendorsSnap.forEach(doc => {
    const data = doc.data();
    if (data.name) {
      context.vendorMap[data.name.toUpperCase()] = {
        category: data.defaultCategory || 'Operating Expenses',
        subcategory: data.defaultCategory || 'Uncategorized'
      };
    }
  });

  // D. Fetch Properties (for matching address-based expenses)
  propertiesSnapWithTenants.forEach(doc => {
    const data = doc.data();
    if (data.address?.street) {
      const streetPart = data.address.street.split(',')[0].toUpperCase(); 
      context.propertyAddresses.push(streetPart);
    }
  });

  return context;
}

// NEW HELPER: Process a Batch with AI
async function categorizeBatchWithAI(
  transactions: PlaidTransaction[], 
  userContext: UserContext
) {
  // 1. Prepare the Data for the Prompt
  const txListString = transactions.map(t => 
    `ID: ${t.transaction_id} | Date: ${t.date} | Desc: "${t.name}" | Amount: ${t.amount}`
  ).join('\n');

  // 2. Call the LLM
  const llmResponse = await ai.generate({
    prompt: CATEGORIZATION_SYSTEM_PROMPT
      .replace('{{industry}}', userContext.business.industry)
      .replace('{{tenantNames}}', userContext.tenantNames.join(', '))
      .replace('{{vendorNames}}', Object.keys(userContext.vendorMap).join(', '))
      .replace('{{propertyAddresses}}', userContext.propertyAddresses.join(', ')),
    input: txListString, // Pass the raw text list
    output: { schema: BatchCategorizationSchema } // Force structured JSON
  });

  return llmResponse.output?.results || [];
}

function categorizeWithContext(
  description: string, 
  amount: number, // Positive = Income, Negative = Expense
  plaidCategory: any,
  context: UserContext
): { primary: string, secondary: string, sub: string, confidence: number } {
  
  const desc = description.toUpperCase();
  const isIncome = amount > 0;
  const { industry, defaultIncomeCategory } = context.business;

  // --- TIER 1: EXACT DATABASE MATCHES ---
  if (isIncome) {
    const matchedTenant = context.tenantNames.find(name => desc.includes(name));
    if (matchedTenant) {
      return { primary: 'Income', secondary: 'Operating Income', sub: defaultIncomeCategory, confidence: 0.95 };
    }
  }
  
  if (!isIncome) {
    const matchedVendor = Object.keys(context.vendorMap).find(name => desc.includes(name));
    if (matchedVendor) {
      const mapping = context.vendorMap[matchedVendor];
      return { primary: 'Operating Expenses', secondary: mapping.category, sub: mapping.subcategory, confidence: 0.95 };
    }
  }

  // --- TIER 2: SMART KEYWORDS ---

  // 1. Zelle & Transfers (The Logic Fix)
  if (desc.includes('ZELLE') || desc.includes('TRANSFER')) {
      if (isIncome) {
          // If money came IN via Zelle/Transfer, it is INCOME.
          return { 
              primary: 'Income', 
              secondary: 'Operating Income', 
              sub: defaultIncomeCategory, // Defaults to "Sales" or "Rental Income"
              confidence: 0.7 
          };
      } else {
          // Money OUT via Zelle
          return { 
              primary: 'Operating Expenses', 
              secondary: 'Uncategorized', 
              sub: 'Contractor or Draw?', 
              confidence: 0.4 
          };
      }
  }

  // 2. Common Vendors (Costco, Visible, etc.)
  if (!isIncome) {
      if (desc.includes('COSTCO') || desc.includes('KROGER') || desc.includes('WALMART') || desc.includes('SAM\'S CLUB')) {
         return { primary: 'Operating Expenses', secondary: 'Office Expenses', sub: 'Supplies', confidence: 0.7 };
      }
      if (desc.includes('VISIBLE') || desc.includes('VERIZON') || desc.includes('AT&T')) {
         return { primary: 'Operating Expenses', secondary: 'General & Administrative', sub: 'Telephone & Internet', confidence: 0.9 };
      }
      if (desc.includes('APPLE.COM') || desc.includes('GOOGLE') || desc.includes('ADOBE') || desc.includes('INTUIT')) {
         return { primary: 'Operating Expenses', secondary: 'General & Administrative', sub: 'Software', confidence: 0.9 };
      }
      if (desc.includes('24 HOUR') || desc.includes('FITNESS') || desc.includes('GYM')) {
         return { primary: 'Equity', secondary: 'Owner\'s Draw', sub: 'Personal Expense', confidence: 0.9 };
      }
  }

  // 3. Loan Payments
  if (desc.includes('LOAN') || desc.includes('MORTGAGE') || desc.includes('PAYMENT - THANK YOU')) {
      return { primary: 'Balance Sheet', secondary: 'Liabilities', sub: 'Loan Payment', confidence: 0.9 };
  }

  // --- TIER 4: THE SAFETY NET (Crucial Fix) ---
  
  if (isIncome) {
      // IF POSITIVE AMOUNT, BUT NO MATCH:
      return { 
          primary: 'Income', 
          secondary: 'Uncategorized', 
          sub: 'Uncategorized Income', // <--- This prevents it from being "General Expense"
          confidence: 0.5 
      };
  }

  // Default Expense
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

        // 1. Fetch User Context
        const userContext = await fetchUserContext(db, userId);

        // 2. Fetch from Plaid
        let allTransactions: PlaidTransaction[] = [];
        let hasMore = true;
        let loopCount = 0;

        while (hasMore && loopCount < 50) {
            loopCount++;
            const response = await plaidClient.transactionsSync({
                access_token: accessToken,
                cursor: cursor,
                count: 500,
            });
            allTransactions = allTransactions.concat(response.data.added);
            hasMore = response.data.has_more;
            cursor = response.data.next_cursor;
        }

        // 3. Filter for 2025
        const STRICT_START_DATE = '2025-01-01'; 
        const relevantTransactions = allTransactions.filter(tx => {
            return tx.date >= STRICT_START_DATE && tx.account_id === bankAccountId;
        });

        if (relevantTransactions.length === 0) {
            await accountRef.update({ plaidSyncCursor: cursor, lastSyncedAt: FieldValue.serverTimestamp() });
            return { count: 0 };
        }

        // 4. BATCH PROCESSING WITH SAFETY FALLBACK
        const BATCH_SIZE = 20; 
        const batchPromises = [];

        for (let i = 0; i < relevantTransactions.length; i += BATCH_SIZE) {
            const chunk = relevantTransactions.slice(i, i + BATCH_SIZE);
            
            const p = categorizeBatchWithAI(chunk, userContext)
                .catch(err => {
                    console.error("AI Batch Failed, falling back to defaults", err);
                    return []; // Return empty if AI crashes so we still save data
                })
                .then(aiResults => {
                    const batch = db.batch();
                    
                    // CRITICAL FIX: Loop over the REAL DATA (chunk), not the AI results
                    chunk.forEach(originalTx => {
                        const docRef = db.collection('users').doc(userId)
                            .collection('bankAccounts').doc(bankAccountId)
                            .collection('transactions').doc(originalTx.transaction_id);

                        // Try to find the matching AI result
                        const aiResult = aiResults.find(r => r.transactionId === originalTx.transaction_id);

                        // Default values if AI missed it
                        const categoryData = aiResult ? {
                            merchantName: aiResult.merchantName,
                            primaryCategory: aiResult.primaryCategory,
                            secondaryCategory: aiResult.secondaryCategory,
                            subcategory: aiResult.subcategory,
                            confidence: aiResult.confidence,
                            aiExplanation: aiResult.explanation,
                            status: aiResult.confidence > 0.85 ? 'posted' : 'review'
                        } : {
                            merchantName: originalTx.merchant_name || originalTx.name,
                            primaryCategory: 'Operating Expenses',
                            secondaryCategory: 'Uncategorized',
                            subcategory: 'General Expense',
                            confidence: 0,
                            aiExplanation: 'AI processing skipped or failed',
                            status: 'review'
                        };

                        batch.set(docRef, {
                            date: originalTx.date,
                            description: originalTx.name,
                            amount: originalTx.amount * -1, // Invert amount
                            plaidTransactionId: originalTx.transaction_id,
                            bankAccountId: originalTx.account_id,
                            userId: userId,
                            createdAt: FieldValue.serverTimestamp(),
                            ...categoryData // Spread the category data (AI or Default)
                        }, { merge: true });
                    });
                    
                    return batch.commit();
                });
            batchPromises.push(p);
        }

        await Promise.all(batchPromises);
        
        await accountRef.update({ 
            plaidSyncCursor: cursor,
            historicalDataPending: false,
            lastSyncedAt: FieldValue.serverTimestamp()
        });

        return { count: relevantTransactions.length };

    } catch (error: any) {
        console.error("Sync Error:", error);
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
  
  
  
  

