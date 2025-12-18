
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

  // =========================================================
  // TIER 1: EXACT DATABASE MATCHES (User's Specific Data)
  // =========================================================
  
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

  // =========================================================
  // TIER 2: SPECIFIC VENDOR RULES (The Fix for your Logs)
  // =========================================================

  if (!isIncome) {

    // 4. TELEPHONE & INTERNET (Visible, Verizon, etc.)
    if (desc.includes('VISIBLE') || desc.includes('VERIZON') || desc.includes('T-MOBILE') || desc.includes('AT&T') || desc.includes('SPECTRUM') || desc.includes('COMCAST') || desc.includes('XFINITY')) {
       return { primary: 'Operating Expenses', secondary: 'General & Administrative', sub: 'Telephone & Internet', confidence: 0.9 };
    }

    // 5. TOLLS & PARKING (NTTA, TxTag, etc.) - Catches "NTTA" before "AUTO" catches it as fuel
    if (desc.includes('NTTA') || desc.includes('TOLL') || desc.includes('EZ PASS') || desc.includes('SUNPASS') || desc.includes('TXT AG') || desc.includes('PARKING') || desc.includes('METER')) {
       return { primary: 'Operating Expenses', secondary: 'Vehicle & Travel', sub: 'Tolls & Parking', confidence: 0.95 };
    }

    // 6. SOFTWARE & SECURITY (Norton, VPN, eSign)
    if (desc.includes('NORTON') || desc.includes('VPN') || desc.includes('ESIGN') || desc.includes('DOCUSIGN') || desc.includes('ADOBE') || desc.includes('INTUIT') || desc.includes('GOOGLE') || desc.includes('MICROSOFT') || desc.includes('GODADDY')) {
       return { primary: 'Operating Expenses', secondary: 'General & Administrative', sub: 'Software & Subscriptions', confidence: 0.9 };
    }

    // 7. ONLINE MARKETPLACES (Amazon)
    if (desc.includes('AMAZON')) {
       // If it's a "Marketplace" or "Retail", it's usually supplies.
       // Unless it's "Amazon Web Services" (AWS), which is software.
       if (desc.includes('AWS') || desc.includes('WEB SERVICES')) {
          return { primary: 'Operating Expenses', secondary: 'General & Administrative', sub: 'Software & Subscriptions', confidence: 0.9 };
       }
       return { primary: 'Operating Expenses', secondary: 'Office Expenses', sub: 'Office Supplies', confidence: 0.8 };
    }

    // 8. GROCERIES & WHOLESALE (Costco, Kroger, Walmart)
    if (desc.includes('COSTCO') || desc.includes('KROGER') || desc.includes('WALMART') || desc.includes('SAM\'S CLUB') || desc.includes('WHOLE FOODS') || desc.includes('HEB') || desc.includes('TARGET')) {
       if (industry === 'Restaurant' || industry === 'Retail') {
          return { primary: 'Cost of Goods Sold', secondary: 'Supplies', sub: 'Inventory/Supplies', confidence: 0.8 };
       }
       return { primary: 'Operating Expenses', secondary: 'Office Expenses', sub: 'Office Supplies', confidence: 0.7 };
    }

    // 9. GAS & AUTO (Catches Fuel)
    if (desc.includes('SHELL') || desc.includes('EXXON') || desc.includes('CHEVRON') || desc.includes('QT') || desc.includes('QUIKTRIP') || desc.includes('AUTOCHARGE') || desc.includes('FUEL')) {
       return { primary: 'Operating Expenses', secondary: 'Vehicle & Travel', sub: 'Fuel', confidence: 0.85 };
    }
    
    // 10. MEALS (In-N-Out, Starbucks, Cafe)
    if (desc.includes('STARBUCKS') || desc.includes('CAFE') || desc.includes('BURGER') || desc.includes('PIZZA') || desc.includes('DINER') || desc.includes('GRILL') || desc.includes('IN-N-OUT') || desc.includes('MOOYAH') || desc.includes('CHICK-FIL-A')) {
       return { primary: 'Operating Expenses', secondary: 'Meals & Entertainment', sub: 'Business Meals', confidence: 0.8 };
    }

    // 11. PERSONAL / OWNER DRAW (Gyms)
    if (desc.includes('FITNESS') || desc.includes('GYM') || desc.includes('24 HOUR') || desc.includes('SALON') || desc.includes('SPA')) {
       return { primary: 'Equity', secondary: 'Owner\'s Draw', sub: 'Personal Expense', confidence: 0.85 };
    }
  }

  // =========================================================
  // TIER 3: SMART FALLBACKS (Plaid Data & Transfers)
  // =========================================================
    
  // 12. INTERNAL BANK TRANSFERS (Checking <-> Savings)
  if (desc.includes('ONLINE BANKING TRANSFER') || desc.includes('TRANSFER FROM SAV') || desc.includes('TRANSFER TO CHK') || desc.includes('TRANSFER TO SAV')) {
      return { primary: 'Balance Sheet', secondary: 'Transfers', sub: 'Internal Transfer', confidence: 0.95 };
  }

  // Credit Card Payments (Paying the bill)
  if (desc.includes('PAYMENT - THANK YOU') || desc.includes('CREDIT CARD PAYMENT')) {
      return { primary: 'Balance Sheet', secondary: 'Liabilities', sub: 'Credit Card Payment', confidence: 0.95 };
  }
  
  // Plaid says "LOAN_PAYMENTS"
  if (plaidCategory?.primary === 'LOAN_PAYMENTS') {
      return { primary: 'Balance Sheet', secondary: 'Liabilities', sub: 'Loan Payment', confidence: 0.8 };
  }

  // =========================================================
  // TIER 4: DEFAULT
  // =========================================================
  
  // SAFETY NET: If we haven't matched it yet and it's income, it's Uncategorized Income
  if (isIncome) {
      return { 
          primary: 'Income', 
          secondary: 'Uncategorized', 
          sub: 'Uncategorized Income',
          confidence: 0.5 
      };
  }
  
  // The final fallback for expenses
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
            
                        // 1. Try to find the AI Result
                        const aiResult = aiResults.find(r => r.transactionId === originalTx.transaction_id);
            
                        let finalCategory;
            
                        if (aiResult) {
                            // CASE A: AI Succeeded
                            finalCategory = {
                                primaryCategory: aiResult.primaryCategory,
                                secondaryCategory: aiResult.secondaryCategory,
                                subcategory: aiResult.subcategory,
                                confidence: aiResult.confidence,
                                aiExplanation: aiResult.explanation,
                                merchantName: aiResult.merchantName,
                                status: aiResult.confidence > 0.85 ? 'posted' : 'review'
                            };
                        } else {
                            // CASE B: AI Failed -> USE SMART RULES (The Fix!)
                            // Instead of "General Expense", we run your specific rules
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
                                aiExplanation: 'AI failed, fell back to Smart Rules',
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
  
  
  
  

    