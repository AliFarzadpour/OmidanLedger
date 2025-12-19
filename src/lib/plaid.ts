













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
import { CATEGORIZATION_SYSTEM_PROMPT, BatchCategorizationSchema } from '@/ai/prompts/categorization';
import { deepCategorizeTransaction } from '@/ai/flows/deep-categorize-transaction';

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

// src/lib/categorization.ts
// 1. ROBUST SANITIZER (Fixes the "/" crash)
export function sanitizeVendorId(text: string): string {
  if (!text) return 'UNKNOWN_VENDOR';
  
  return text.toUpperCase()
    .replace(/\//g, '_')       // REPLACE SLASH WITH UNDERSCORE (Critical Fix)
    .replace(/\\/g, '_')       // Replace backslash
    .replace(/[#\?]/g, '')     // Remove illegal Firestore chars
    .replace(/[^\w\s_]/g, '')  // Remove other punctuation
    .replace(/\s+/g, '_')      // Replace spaces with underscores
    .trim();
}

export async function getCategoryFromDatabase(
  merchantName: string, 
  userId: string, 
  db: FirebaseFirestore.Firestore
) {
  // SAFETY CHECK: If name is missing, skip DB
  if (!merchantName) return null;

  const desc = merchantName.toUpperCase();
  
  // Generate tokens, handling slashes as splitters too
  const tokens = desc.split(/[\s,.*\/]+/).filter(t => t.length > 2);
  
  // Sanitize the full ID
  const cleanId = sanitizeVendorId(desc);
  
  // 1. CHECK USER'S PERSONAL RULES
  const userRuleRef = db.collection('users').doc(userId).collection('vendorRules').doc(cleanId);
  const userRuleSnap = await userRuleRef.get();

  if (userRuleSnap.exists) {
      return { ...userRuleSnap.data(), confidence: 1.0, source: 'User Rule' };
  }

  // 2. CHECK GLOBAL MASTER DATABASE
  // Check tokens individually (sanitized)
  for (const token of tokens) {
      const safeToken = sanitizeVendorId(token);
      if (!safeToken) continue;

      const globalDoc = await db.collection('globalVendorMap').doc(safeToken).get();
      if (globalDoc.exists) {
          return { ...globalDoc.data(), confidence: 0.95, source: 'Global DB' };
      }
  }
  
  // Check full string match
  const globalDocFull = await db.collection('globalVendorMap').doc(cleanId).get();
  if (globalDocFull.exists) {
      return { ...globalDocFull.data(), confidence: 0.95, source: 'Global DB' };
  }

  return null;
}


/**
 * Fetches User Settings, Tenants, Vendors, and Properties to give the AI context.
 */
export async function fetchUserContext(db: FirebaseFirestore.Firestore, userId: string): Promise<UserContext> {
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

// RENAMED: This is now the fallback heuristic engine
export async function categorizeWithHeuristics(
  description: string, 
  amount: number, 
  plaidCategory: any, 
  context: UserContext
): Promise<{ primary: string, secondary: string, sub: string, confidence: number }> {
  
  // CRITICAL FIX: Handle null/undefined values safely
  const safeDesc = description || ''; 
  const desc = safeDesc.toUpperCase();
  
  // Remove punctuation for cleaner matching
  const cleanDesc = desc.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g," ");
  
  const isIncome = amount > 0;
  const { defaultIncomeCategory } = context.business || {}; // Safety check on context

  // =========================================================
  // CRITICAL: HARD OVERRIDES (Direction Check)
  // =========================================================

  // 1. Internal Transfers (Check this FIRST for both Income and Expense)
  // Moves money between accounts -> Balance Sheet
  if (desc.includes('ONLINE BANKING TRANSFER') || 
      desc.includes('TRANSFER TO CHK') || 
      desc.includes('TRANSFER FROM CHK') || 
      desc.includes('INTERNAL TRANSFER')) {
      return { primary: 'Balance Sheet', secondary: 'Transfers', sub: 'Internal Transfer', confidence: 1.0 };
  }

  // 2. FORCE INCOME (If Amount > 0)
  // This prevents "Rent" from ever being an Expense if money came IN.
  if (isIncome) {
      // Specific Income Types
      if (desc.includes('RENT') || desc.includes('LEASE')) {
          return { primary: 'Income', secondary: 'Rental Income', sub: 'Residential/Commercial Rent', confidence: 1.0 };
      }
      if (desc.includes('DEPOSIT') && !desc.includes('REFUND')) {
          // Security deposits received could be Liabilities (Held for tenant) or Income depending on accounting method.
          // For now, let's map to Rental Income > Deposits to keep it simple, or Liability if you prefer.
          return { primary: 'Income', secondary: 'Rental Income', sub: 'Security Deposit', confidence: 0.9 };
      }
      if (desc.includes('INTEREST')) {
          return { primary: 'Income', secondary: 'Other Income', sub: 'Interest Income', confidence: 1.0 };
      }
      if (desc.includes('REFUND') || desc.includes('RETURN')) {
           // Refunds usually map back to the expense category, but "Uncategorized Income" is safer if unknown.
           return { primary: 'Income', secondary: 'Uncategorized', sub: 'Refunds/Credits', confidence: 0.8 };
      }

      // Default Catch-All for ALL other Positive Amounts
      // This is the safety net that stops "Home Depot Refund" from becoming "Supplies Expense"
      return { primary: 'Income', secondary: 'Operating Income', sub: defaultIncomeCategory || 'Sales', confidence: 0.7 };
  }

  // =========================================================
  // EXPENSES ONLY (Amount < 0)
  // =========================================================
  
  // 1. Debt Payments (Liabilities)
  if (desc.includes('PAYMENT - THANK YOU') || desc.includes('PAYMENT RECEIVED') || desc.includes('CREDIT CARD') || desc.includes('LOAN') || desc.includes('MORTGAGE')) {
      return { primary: 'Balance Sheet', secondary: 'Liabilities', sub: 'Loan/Card Payment', confidence: 0.95 };
  }
  
  // =========================================================
  // TIER 3: PLAID CATEGORY FALLBACK
  // =========================================================
  
  // CRITICAL FIX: Handle missing Plaid data safely
  const plaidPrimary = (plaidCategory?.primary || '').toUpperCase();
  const plaidDetailed = (plaidCategory?.detailed || '').toUpperCase();

  if (!isIncome) {
      if (plaidPrimary === 'FOOD_AND_DRINK') {
          return { primary: 'Operating Expenses', secondary: 'Meals & Entertainment', sub: 'Business Meals', confidence: 0.8 };
      }
       if (plaidPrimary === 'PERSONAL_CARE' || plaidPrimary === 'GENERAL_MERCHANDISE') {
        if (plaidDetailed.includes('CLOTHING') || plaidDetailed.includes('BEAUTY') || plaidDetailed.includes('GYM') || plaidDetailed.includes('SPORTING')) {
            return { primary: 'Equity', secondary: 'Owner\'s Draw', sub: 'Personal Expense', confidence: 0.9 };
        }
    }
    if (plaidPrimary === 'TRAVEL') {
        if (plaidDetailed.includes('TAXI') || plaidDetailed.includes('PARKING') || plaidDetailed.includes('TOLLS')) {
            return { primary: 'Operating Expenses', secondary: 'Vehicle & Travel', sub: 'Tolls & Parking', confidence: 0.9 };
        }
        if (plaidDetailed.includes('GAS')) {
            return { primary: 'Operating Expenses', secondary: 'Vehicle & Travel', sub: 'Fuel', confidence: 0.9 };
        }
        return { primary: 'Operating Expenses', secondary: 'Vehicle & Travel', sub: 'Travel & Lodging', confidence: 0.9 };
    }
    if (plaidPrimary === 'SERVICE') {
        if (plaidDetailed.includes('INTERNET') || plaidDetailed.includes('TELEPHONE')) {
            return { primary: 'Operating Expenses', secondary: 'General & Administrative', sub: 'Telephone & Internet', confidence: 0.9 };
        }
        if (plaidDetailed.includes('UTILITIES')) {
            return { primary: 'Operating Expenses', secondary: 'General & Administrative', sub: 'Rent & Utilities', confidence: 0.9 };
        }
    }
  }

  // Example for Rent EXPENSE (Paying a landlord)
  if (desc.includes('RENT') || desc.includes('LEASE')) {
      return { primary: 'Operating Expenses', secondary: 'Rent & Lease', sub: 'Rent Expense', confidence: 0.9 };
  }


  return { primary: 'Operating Expenses', secondary: 'Uncategorized', sub: 'General Expense', confidence: 0.1 };
}

export async function enforceAccountingRules(
  category: any, 
  amount: number
) {
  const isIncome = amount > 0;
  const isExpense = amount < 0;
  
  // CLONE the category object so we don't mutate the original
  let final = { ...category };

  // RULE 1: Positive Amount CANNOT be an Operating Expense
  // (Unless it's a refund, but usually "Rental Income" is the safer default for large amounts)
  if (isIncome && (final.primaryCategory.includes('Expense') || final.primaryCategory === 'Property Expenses' || final.primaryCategory === 'Real Estate')) {
      
      // If description mentions Rent/Lease, force it to Income
      if (final.subcategory?.includes('Rent') || final.subcategory?.includes('Lease')) {
          final.primaryCategory = 'Income';
          final.secondaryCategory = 'Rental Income';
          final.subcategory = 'Residential Rent';
          final.aiExplanation = 'Forced to Income by Accounting Enforcer (Positive Amount)';
      } 
      // General catch-all for other positive "expenses"
      else {
          final.primaryCategory = 'Income';
          final.secondaryCategory = 'Uncategorized Income';
      }
  }

  // RULE 2: Transfers & Credit Card Payments are ALWAYS Balance Sheet
  // (This ensures your previous fix stays locked in)
  if (final.subcategory === 'Credit Card Payment' || final.subcategory === 'Internal Transfer') {
      final.primaryCategory = 'Balance Sheet';
      if (amount > 0 && final.subcategory === 'Credit Card Payment') {
          // Positive credit card payment = Paying off the debt (Liability)
          final.secondaryCategory = 'Liabilities';
      }
  }

  return final;
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

        // 3. Filter for relevant transactions
        const relevantTransactions = allTransactions.filter(tx => {
            return tx.account_id === bankAccountId;
        });

        if (relevantTransactions.length === 0) {
            await accountRef.update({ plaidSyncCursor: cursor, lastSyncedAt: FieldValue.serverTimestamp() });
            return { count: 0 };
        }

        // 4. BATCH PROCESSING
        const BATCH_SIZE = 3; 
        const batchPromises = [];

        for (let i = 0; i < relevantTransactions.length; i += BATCH_SIZE) {
            const chunk = relevantTransactions.slice(i, i + BATCH_SIZE);
            
            const p = (async () => {
                const batch = db.batch();
                
                for (const originalTx of chunk) {
                    const docRef = db.collection('users').doc(userId)
                        .collection('bankAccounts').doc(bankAccountId)
                        .collection('transactions').doc(originalTx.transaction_id);

                    const signedAmount = originalTx.amount * -1; // Invert amount
                    let finalCategory: any;

                    // A. Try DB Lookup First (Fast & Cheap)
                    const dbResult = await getCategoryFromDatabase(originalTx.name, userId, db);

                    if (dbResult) {
                         // CASE A: Database Match Found (User or Global)
                        finalCategory = {
                            primaryCategory: dbResult.primary,
                            secondaryCategory: dbResult.secondary,
                            subcategory: dbResult.sub,
                            confidence: dbResult.confidence,
                            aiExplanation: `Matched rule via ${dbResult.source}`,
                            merchantName: originalTx.merchant_name || originalTx.name,
                            status: 'posted' // Auto-approve known items
                        };
                    } else {
                        // CASE B: Unknown -> Send to Deep AI (Slower & Costly)
                        const deepResult = await deepCategorizeTransaction({
                            description: originalTx.name,
                            amount: signedAmount,
                            date: originalTx.date
                        });
                        
                        if (deepResult && deepResult.confidence > 0.7) {
                            // Good AI Result
                            finalCategory = {
                                primaryCategory: deepResult.primaryCategory,
                                secondaryCategory: deepResult.secondaryCategory,
                                subcategory: deepResult.subcategory,
                                confidence: deepResult.confidence,
                                aiExplanation: deepResult.reasoning,
                                merchantName: deepResult.merchantName,
                                status: 'posted'
                            };
                        } else {
                            // C. If AI also failed, use Heuristics as final fallback
                            const ruleResult = await categorizeWithHeuristics(originalTx.name, signedAmount, originalTx.personal_finance_category, userContext);
                            finalCategory = {
                                primaryCategory: ruleResult.primary,
                                secondaryCategory: ruleResult.secondary,
                                subcategory: ruleResult.sub,
                                confidence: ruleResult.confidence,
                                aiExplanation: 'Deep AI failed, used standard Rules',
                                merchantName: originalTx.merchant_name || originalTx.name,
                                status: 'review'
                            };
                        }
                    }

                    // Enforce accounting rules as a final check
                    const enforcedCategory = await enforceAccountingRules(finalCategory, signedAmount);
                    
                    batch.set(docRef, {
                        date: originalTx.date,
                        description: originalTx.name,
                        amount: signedAmount,
                        plaidTransactionId: originalTx.transaction_id,
                        bankAccountId: originalTx.account_id,
                        userId: userId,
                        createdAt: FieldValue.serverTimestamp(),
                        ...enforcedCategory 
                    }, { merge: true });
                }
                
                return batch.commit();
            })();
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
  







