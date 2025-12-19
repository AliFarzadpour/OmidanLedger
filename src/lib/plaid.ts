

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
  amount: number, 
  plaidCategory: any,
  context: UserContext
): { primary: string, secondary: string, sub: string, confidence: number } {
  
  const desc = description.toUpperCase();
  // Remove special chars to help matching "T.J.MAXX" vs "TJ MAXX"
  const cleanDesc = desc.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g," ");
  
  const isIncome = amount > 0;
  const { industry, defaultIncomeCategory } = context.business;

  // =========================================================
  // TIER 1: EXACT DATABASE MATCHES
  // =========================================================
  if (isIncome) {
    const matchedTenant = context.tenantNames.find(name => desc.includes(name));
    if (matchedTenant) return { primary: 'Income', secondary: 'Operating Income', sub: defaultIncomeCategory, confidence: 0.95 };
  } else {
    const matchedVendor = Object.keys(context.vendorMap).find(name => desc.includes(name));
    if (matchedVendor) {
        const mapping = context.vendorMap[matchedVendor];
        return { primary: 'Operating Expenses', secondary: mapping.category, sub: mapping.subcategory, confidence: 0.95 };
    }
  }

  // =========================================================
  // TIER 2: HIGH PRIORITY (Personal & Travel)
  // =========================================================

  if (!isIncome) {
      // 1. AIRLINES & TRAVEL (Fixes Frontier collision)
      // We check specific airline codes FIRST before checking "Frontier" as a utility
      if (desc.includes('AIRLINE') || desc.includes('AIRWAYS') || desc.includes('DELTA') || desc.includes('UNITED') || 
          desc.includes('SOUTHWEST') || desc.includes('AMERICAN AIR') || desc.includes('SPIRIT AIR') || 
          desc.includes('FRONTIER A') || desc.includes('FRONTIER K') || // "FRONTIER KH5UGT" is the airline format
          desc.includes('TRIP.COM') || desc.includes('EXPEDIA') || desc.includes('SIXT') || desc.includes('HERTZ') || 
          desc.includes('HUDSONNEWS') || desc.includes('HUDSON NEWS')) { // Hudson News is Travel Meal/Snack
         if (desc.includes('HUDSON')) return { primary: 'Operating Expenses', secondary: 'Meals & Entertainment', sub: 'Travel Meals', confidence: 0.85 };
         return { primary: 'Operating Expenses', secondary: 'Vehicle & Travel', sub: 'Travel & Lodging', confidence: 0.9 };
      }

      // 2. PERSONAL / OWNER DRAW (Retail Fix)
      // Expanded list based on your log
      if (cleanDesc.includes('TJ MAXX') || desc.includes('MACY') || desc.includes('NORDSTROM') || desc.includes('DILLARD') || 
          desc.includes('MARSHALLS') || desc.includes('ROSS') || desc.includes('H&M') || desc.includes('ZARA') || 
          desc.includes('UNIQLO') || desc.includes('SKECHERS') || desc.includes('NIKE') || desc.includes('ADIDAS') || 
          desc.includes('LULULEMON') || desc.includes('CALVIN KLEIN') || desc.includes('CALVIN') || 
          desc.includes('NAUTICA') || desc.includes('COLUMBIA') || desc.includes('BEYOND CLIPS') || 
          desc.includes('STONEBRIAR') || // Mall Name = Shopping
          desc.includes('NAIL') || desc.includes('BEAUTY') || desc.includes('SALON') || desc.includes('SPA ') || 
          desc.includes('FITNESS') || desc.includes('GYM') || desc.includes('CINEMARK')) {
         return { primary: 'Equity', secondary: 'Owner\'s Draw', sub: 'Personal Expense', confidence: 0.85 };
      }
  }

  // =========================================================
  // TIER 3: UTILITIES & SOFTWARE
  // =========================================================
  
  if (!isIncome) {
      // 3. UTILITIES
      if (desc.includes('FRONTIER') || // Frontier without airline codes is likely internet
          desc.includes('CITY OF') || desc.includes('TOWN OF') || desc.includes('UTILITIES') || 
          desc.includes('WATER') || desc.includes('ELECTRIC') || desc.includes('POWER') || desc.includes('ATMOS')) {
         return { primary: 'Operating Expenses', secondary: 'General & Administrative', sub: 'Rent & Utilities', confidence: 0.8 };
      }

      // 4. SOFTWARE & CLOUD
      if (desc.includes('CLOUD') || desc.includes('ADROLL') || desc.includes('OPENAI') || desc.includes('DIGITALOCEAN') || 
          desc.includes('GODADDY') || desc.includes('NAME-CHEAP') || desc.includes('ADOBE') || desc.includes('INTUIT') || 
          desc.includes('GOOGLE') || desc.includes('MICROSOFT')) {
         return { primary: 'Operating Expenses', secondary: 'General & Administrative', sub: 'Software & Subscriptions', confidence: 0.9 };
      }
  }

  // =========================================================
  // TIER 4: RESTAURANTS (The "Catch-All" for Food)
  // =========================================================

  if (!isIncome) {
      if (desc.includes('RESTAURANT') || desc.includes('CAFE') || desc.includes('COFFEE') || desc.includes('GRILL') || 
          desc.includes('BAR') || desc.includes('PIZZA') || desc.includes('BURGER') || desc.includes('DINER') || 
          desc.includes('STEAK') || desc.includes('SUSHI') || desc.includes('TACO') || desc.includes('DONUT') || 
          desc.includes('BAKERY') || desc.includes('KITCHEN') || 
          desc.includes('STARBUCKS') || desc.includes('MCDONALD') || desc.includes('CHICK-FIL-A') || 
          desc.includes('IN-N-OUT') || desc.includes('WENDY') || desc.includes('DENNY') || desc.includes('PANERA') || 
          desc.includes('CHUY') || desc.includes('CHEESECAKE') || desc.includes('BRAUMS') || 
          desc.includes('TB REST') || desc.includes('TB RET')) { // TB REST = Taco Bell
         return { primary: 'Operating Expenses', secondary: 'Meals & Entertainment', sub: 'Business Meals', confidence: 0.8 };
      }
      
      // 7-Eleven is often Fuel or Meals. Defaulting to Fuel for safety if it's a road trip context.
      if (desc.includes('7-ELEVEN') || desc.includes('RACETRAC') || desc.includes('QT') || desc.includes('SHELL')) {
          return { primary: 'Operating Expenses', secondary: 'Vehicle & Travel', sub: 'Fuel', confidence: 0.7 };
      }
  }

  // =========================================================
  // TIER 5: LOANS & TRANSFERS
  // =========================================================
  if (desc.includes('PAYMENT - THANK YOU') || desc.includes('PAYMENT RECEIVED') || desc.includes('CREDIT CARD')) {
      return { primary: 'Balance Sheet', secondary: 'Liabilities', sub: 'Credit Card Payment', confidence: 0.95 };
  }
  if (desc.includes('LOAN') || desc.includes('MORTGAGE')) {
      return { primary: 'Balance Sheet', secondary: 'Liabilities', sub: 'Loan Payment', confidence: 0.95 };
  }

  // Safety Net for Income
  if (isIncome) return { primary: 'Income', secondary: 'Uncategorized', sub: 'Uncategorized Income', confidence: 0.5 };

  return { primary: 'Operating Expenses', secondary: 'Uncategorized', sub: 'General Expense', confidence: 0.1 };
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
        const BATCH_SIZE = 10; 
        const batchPromises = [];

        for (let i = 0; i < relevantTransactions.length; i += BATCH_SIZE) {
            const chunk = relevantTransactions.slice(i, i + BATCH_SIZE);
            
            const p = categorizeBatchWithAI(chunk, userContext)
                .catch(err => {
                    console.error("AI Batch Failed:", err);
                    return []; // Return empty list so we trigger the fallback below
                })
                .then(aiResults => {
                    const batch = db.batch();
                    
                    chunk.forEach(originalTx => {
                        const docRef = db.collection('users').doc(userId)
                            .collection('bankAccounts').doc(bankAccountId)
                            .collection('transactions').doc(originalTx.transaction_id);
            
                        const signedAmount = originalTx.amount * -1; // Invert amount
            
                        const aiResult = aiResults.find(r => r.transactionId === originalTx.transaction_id);
                        
                        // STRICTOR CHECK: Reject AI if it guesses "General Expense" or has low confidence
                        const isAiUseless = 
                            !aiResult || 
                            aiResult.primaryCategory === 'Uncategorized' ||
                            aiResult.secondaryCategory === 'Uncategorized' ||
                            aiResult.secondaryCategory === 'General Expense' || // <--- ADD THIS
                            aiResult.subcategory === 'General Expense' ||       // <--- ADD THIS
                            aiResult.confidence < 0.85;                         // <--- Force high standard

                        let finalCategory;
            
                        if (!isAiUseless) {
                            // AI is confident and specific -> Use it
                            finalCategory = { ...aiResult, status: 'posted' };
                        } else {
                            // AI failed, was vague, or low confidence -> FORCE RULES
                            const ruleResult = categorizeWithContext(
                                originalTx.name, 
                                signedAmount, 
                                originalTx.personal_finance_category, 
                                userContext
                            );
                            
                            finalCategory = {
                                primaryCategory: ruleResult.primary,
                                secondaryCategory: ruleResult.secondary,
                                subcategory: ruleResult.sub,
                                confidence: ruleResult.confidence,
                                aiExplanation: aiResult 
                                    ? `AI result (${aiResult.subcategory}) rejected, used Smart Rules` 
                                    : 'AI Failed, used Smart Rules',
                                merchantName: originalTx.merchant_name || originalTx.name,
                                status: ruleResult.confidence > 0.8 ? 'posted' : 'review'
                            };
                        }
            
                        // 2. Save to Database
                        batch.set(docRef, {
                            date: originalTx.date,
                            description: originalTx.name,
                            amount: signedAmount,
                            plaidTransactionId: originalTx.transaction_id,
                            bankAccountId: originalTx.account_id,
                            userId: userId,
                            createdAt: FieldValue.serverTimestamp(),
                            
                            // Spread the calculated category (AI or Rule)
                            ...finalCategory 
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
  
  
  
  

    

    

    

    