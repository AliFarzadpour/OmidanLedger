

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
import { incrementPropertyStats } from '@/actions/update-property-stats';

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
  userRules: Array<{
    keyword: string;
    categoryHierarchy: {
        l0: string;
        l1: string;
        l2: string;
        l3: string;
    },
    propertyId: string | null;
  }>;
}

// 1. ROBUST SANITIZER
function sanitizeVendorId(text: string): string {
  if (!text) return 'UNKNOWN_VENDOR';
  // Remove common suffixes and prefixes, asterisks, and truncate at the first sign of a transaction ID
  const cleaned = text.toUpperCase()
    .replace(/\s+(LLC|INC|CORP|LTD)\.?$/g, '')
    .replace(/^(SQ|TST)\*/, '')
    .replace(/\*.*$/, '') // Remove everything after a star, often indicating a terminal ID
    .replace(/#\d+$/, '') // Remove trailing numbers like #1234
    .trim();

  return cleaned
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "") // Remove most special characters
    .replace(/\s+/g, '_'); // Replace spaces with underscores
}

export async function getCategoryFromDatabase(
  merchantName: string, 
  context: UserContext,
  db: FirebaseFirestore.Firestore
) {
  if (!merchantName) return null;

  const desc = merchantName.toUpperCase();
  
  // --- A. CHECK USER RULES (IN-MEMORY) - Priority 1 ---
  const matchedRule = context.userRules.find(rule => 
      desc.includes(rule.keyword) 
  );

  if (matchedRule) {
      return { 
          categoryHierarchy: matchedRule.categoryHierarchy,
          propertyId: matchedRule.propertyId || null,
          confidence: 1.0,
          source: 'User Rule' 
      };
  }
  
  // --- B. CHECK GLOBAL MASTER DATABASE (FIRESTORE) - Priority 2 ---
  try {
      const cleanId = sanitizeVendorId(desc);
      const globalDoc = await db.collection('globalVendorMap').doc(cleanId).get();
      
      if (globalDoc.exists) {
          const data = globalDoc.data();
          if (data) {
              return { 
                  categoryHierarchy: {
                      l0: data.primary,
                      l1: data.secondary,
                      l2: data.sub,
                      l3: '' // Global rules don't have L3 detail
                  },
                  confidence: 0.95, 
                  source: 'Global DB' 
              };
          }
      }
  } catch (error) {
      console.warn("Global DB Lookup failed:", error);
  }

  return null; 
}


export async function fetchUserContext(db: FirebaseFirestore.Firestore, userId: string): Promise<UserContext> {
  const settingsSnap = await db.doc(`users/${userId}`).get();
  const settings = settingsSnap.data() || {};
  
  const business: BusinessProfile = {
    industry: settings.trade || 'General',
    defaultIncomeCategory: 'Rental Income' 
  };

  const context: UserContext = {
    business,
    tenantNames: [],
    vendorMap: {},
    propertyAddresses: [],
    userRules: []
  };

  const rulesSnap = await db.collection('users').doc(userId).collection('categoryMappings').get();
  rulesSnap.forEach(doc => {
      const data = doc.data();
      const keyword = (data.transactionDescription || data.originalKeyword || '').toUpperCase();
      if (keyword && data.categoryHierarchy) {
          context.userRules.push({
              keyword: keyword,
              categoryHierarchy: data.categoryHierarchy,
              propertyId: data.propertyId || null 
          });
      }
  });

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
    if (data.address?.street) {
        const streetPart = data.address.street.split(',')[0].toUpperCase(); 
        context.propertyAddresses.push(streetPart);
    }
  });
  
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

  return context;
}

export async function categorizeBatchWithAI(
  transactions: PlaidTransaction[], 
  userContext: UserContext
) {
  const txListString = transactions.map(t => 
    `ID: ${t.transaction_id} | Date: ${t.date} | Desc: "${t.name}" | Amount: ${t.amount}`
  ).join('\n');

  const llmResponse = await ai.generate({
    prompt: CATEGORIZATION_SYSTEM_PROMPT
      .replace('{{industry}}', userContext.business.industry)
      .replace('{{tenantNames}}', userContext.tenantNames.join(', '))
      .replace('{{vendorNames}}', Object.keys(userContext.vendorMap).join(', '))
      .replace('{{propertyAddresses}}', userContext.propertyAddresses.join(', ')),
    input: txListString,
    output: { schema: BatchCategorizationSchema }
  });

  return llmResponse.output?.results || [];
}

export async function categorizeWithHeuristics(
  description: string, 
  amount: number, 
  plaidCategory: any, 
  context: UserContext
): Promise<{ l0: string, l1: string, l2: string, l3: string, confidence: number }> {
  
  const safeDesc = description || ''; 
  const desc = safeDesc.toUpperCase();
  const plaidPrimary = (plaidCategory?.primary || '').toUpperCase();
  const plaidDetailed = (plaidCategory?.detailed || '').toUpperCase();
  
  // LAW #1: Handle Credit Card Payments (from both sides of the transaction)
  if (plaidPrimary === 'TRANSFER_OUT' && plaidDetailed.includes('CREDIT_CARD')) {
      return { l0: 'Liability', l1: 'CC Payment', l2: 'Internal Transfer', l3: 'Credit Card Payment', confidence: 1.0 };
  }
  if (amount > 0 && plaidPrimary === 'TRANSFER_IN' && plaidDetailed.includes('CREDIT_CARD_PAYMENT')) {
      return { l0: 'Liability', l1: 'CC Payment', l2: 'Internal Transfer', l3: 'Credit Card Payment', confidence: 1.0 };
  }
  // Enhanced Rule for Bank Account Debits to Credit Cards
  if (desc.includes('PAYMENT - THANK YOU') || 
      desc.includes('PAYMENT RECEIVED, THANK') || 
      desc.includes('ONLINE PAYMENT') ||
      desc.includes('BANK OF AMERICA BUSINESS CARD') || // From user feedback
      desc.includes('BARCLAYCARD US') || // From user feedback
      desc.includes('CITI AUTOPAY') // From user feedback
     ) {
      return { l0: 'Liability', l1: 'CC Payment', l2: 'Internal Transfer', l3: 'Credit Card Payment', confidence: 1.0 };
  }
  
  // Rule for Internal Bank Transfers
  if (desc.includes('ONLINE BANKING TRANSFER') || 
      desc.includes('TRANSFER TO CHK') || 
      desc.includes('TRANSFER FROM CHK') || 
      desc.includes('INTERNAL TRANSFER')) {
      return { l0: 'Asset', l1: 'Cash Movement', l2: 'Internal Transfer', l3: 'Bank Transfer', confidence: 1.0 };
  }

  // Handle Income
  if (amount > 0) {
      if (desc.includes('RENT') || desc.includes('LEASE')) {
          return { l0: 'Income', l1: 'Rental Income', l2: 'Line 3: Rents Received', l3: 'Rent', confidence: 1.0 };
      }
      if (desc.includes('DEPOSIT') && !desc.includes('REFUND')) {
          return { l0: 'Liability', l1: 'Tenant Deposits', l2: 'Security Deposits Held', l3: 'Deposit In', confidence: 0.9 };
      }
      if (desc.includes('INTEREST')) {
          return { l0: 'Income', l1: 'Non-Operating', l2: 'Bank Interest', l3: 'Interest Earned', confidence: 1.0 };
      }
      if (desc.includes('REFUND') || desc.includes('RETURN')) {
           return { l0: 'Income', l1: 'Adjustments', l2: 'Refunds/Credits', l3: 'Refund', confidence: 0.8 };
      }
      return { l0: 'Income', l1: 'Rental Income', l2: 'Line 3: Rents Received', l3: 'Uncategorized Income', confidence: 0.7 };
  }
  
  // Handle Debt Payments (non-credit card)
  if (desc.includes('LOAN') || desc.includes('MORTGAGE')) {
      return { l0: 'Liability', l1: 'Debt Service', l2: 'Loan Paydown', l3: 'Loan/Mortgage Payment', confidence: 0.95 };
  }
  
  // Handle Expenses using Plaid hints
  if (amount < 0) {
      if (plaidPrimary === 'FOOD_AND_DRINK') {
          return { l0: 'Expense', l1: 'Meals', l2: 'Line 19: Other (Meals)', l3: 'Business Meals', confidence: 0.8 };
      }
       if (plaidPrimary === 'PERSONAL_CARE' || plaidPrimary === 'GENERAL_MERCHANDISE') {
        if (plaidDetailed.includes('CLOTHING') || plaidDetailed.includes('BEAUTY') || plaidDetailed.includes('GYM') || plaidDetailed.includes('SPORTING')) {
            return { l0: 'Equity', l1: 'Owner Distribution', l2: 'Personal Draw', l3: 'Personal Spending', confidence: 0.9 };
        }
    }
    if (plaidPrimary === 'TRAVEL') {
        if (plaidDetailed.includes('TAXI') || plaidDetailed.includes('PARKING') || plaidDetailed.includes('TOLLS')) {
            return { l0: 'Expense', l1: 'Transportation', l2: 'Line 6: Auto & Travel', l3: 'Tolls & Parking', confidence: 0.9 };
        }
        if (plaidDetailed.includes('GAS')) {
            return { l0: 'Expense', l1: 'Transportation', l2: 'Line 6: Auto & Travel', l3: 'Fuel', confidence: 0.9 };
        }
        return { l0: 'Expense', l1: 'Transportation', l2: 'Line 6: Auto & Travel', l3: 'Travel & Lodging', confidence: 0.9 };
    }
    if (plaidPrimary === 'SERVICE') {
        if (plaidDetailed.includes('INTERNET') || plaidDetailed.includes('TELEPHONE')) {
            return { l0: 'Expense', l1: 'Utilities', l2: 'Line 17: Utilities', l3: 'Telephone & Internet', confidence: 0.9 };
        }
        if (plaidDetailed.includes('UTILITIES')) {
            return { l0: 'Expense', l1: 'Utilities', l2: 'Line 17: Utilities', l3: 'General Utilities', confidence: 0.9 };
        }
    }
  }

  if (desc.includes('RENT') || desc.includes('LEASE')) {
      return { l0: 'Expense', l1: 'Operations', l2: 'Line 19: Other Expenses', l3: 'Rent Expense', confidence: 0.9 };
  }

  // Final fallback
  return { l0: 'Expense', l1: 'General', l2: 'Needs Review', l3: 'General Expense', confidence: 0.1 };
}

/**
 * A final, non-negotiable check to enforce core accounting principles.
 */
export async function enforceAccountingRules(
  category: any, 
  amount: number
): Promise<any> {
  const isNegative = amount < 0;
  const isIncomeCategory = category.categoryHierarchy?.l0?.toLowerCase().includes('income');

  // **Guardrail 1: Negative Income**
  if (isNegative && isIncomeCategory) {
    return {
      ...category,
      categoryHierarchy: {
        l0: 'Expense',
        l1: 'General',
        l2: 'Needs Review',
        l3: 'Uncategorized Expense',
      },
      aiExplanation: `Rule Violation: Negative amount cannot be Income. Original: ${category.categoryHierarchy.l2}`,
      reviewStatus: 'needs-review',
    };
  }

  return category; 
}


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

        const userContext = await fetchUserContext(db, userId);

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
        
        const relevantTransactions = allTransactions.filter(tx => {
            return tx.account_id === bankAccountId && !tx.pending;
        });

        if (relevantTransactions.length === 0) {
            await accountRef.update({ plaidSyncCursor: cursor, lastSyncedAt: FieldValue.serverTimestamp() });
            return { count: 0 };
        }

        const BATCH_SIZE = 10; 
        const batchPromises = [];

        for (let i = 0; i < relevantTransactions.length; i += BATCH_SIZE) {
            const chunk = relevantTransactions.slice(i, i + BATCH_SIZE);
            
            const p = (async () => {
                const batch = db.batch();
                
                for (const originalTx of chunk) {
                    const docRef = db.collection('users').doc(userId)
                        .collection('bankAccounts').doc(bankAccountId)
                        .collection('transactions').doc(originalTx.transaction_id);

                    const signedAmount = originalTx.amount * -1;
                    let finalCategory: any;

                    // <<<<---- NEW LOGIC ---->>>>
                    // 1. RULES ENGINE FIRST
                    const ruleResult = await getCategoryFromDatabase(originalTx.name, userContext, db);
                    
                    if (ruleResult) {
                        finalCategory = {
                            categoryHierarchy: ruleResult.categoryHierarchy,
                            propertyId: ruleResult.propertyId || null,
                            confidence: 1.0,
                            aiExplanation: `Matched Rule: ${ruleResult.source}`,
                            merchantName: originalTx.merchant_name || originalTx.name,
                            status: 'posted',
                            source: ruleResult.source,
                        };
                    } else {
                        // 2. AI FALLBACK
                        const deepResult = await deepCategorizeTransaction({
                            description: originalTx.name,
                            amount: signedAmount,
                            date: originalTx.date
                        });
                        
                        if (deepResult && deepResult.confidence > 0.7) {
                            finalCategory = {
                                categoryHierarchy: {
                                    l0: deepResult.primaryCategory,
                                    l1: deepResult.secondaryCategory,
                                    l2: deepResult.subcategory,
                                    l3: '',
                                },
                                confidence: deepResult.confidence,
                                aiExplanation: deepResult.reasoning,
                                merchantName: deepResult.merchantName,
                                status: 'posted',
                                propertyId: null // AI doesn't know property
                            };
                        } else {
                            // 3. HEURISTICS LAST RESORT
                            const heuristicResult = await categorizeWithHeuristics(originalTx.name, signedAmount, originalTx.personal_finance_category, userContext);
                            finalCategory = {
                                categoryHierarchy: {
                                    l0: heuristicResult.l0,
                                    l1: heuristicResult.l1,
                                    l2: heuristicResult.l2,
                                    l3: heuristicResult.l3
                                },
                                confidence: heuristicResult.confidence,
                                aiExplanation: 'Deep AI failed, used standard Rules',
                                merchantName: originalTx.merchant_name || originalTx.name,
                                status: 'review',
                                propertyId: null
                            };
                        }
                    }
                    
                    // 4. FINAL ACCOUNTING GUARDRAIL
                    const enforcedCategory = await enforceAccountingRules(finalCategory, signedAmount);
                    
                    const txData = {
                        date: originalTx.date,
                        description: originalTx.name,
                        amount: signedAmount,
                        plaidTransactionId: originalTx.transaction_id,
                        bankAccountId: originalTx.account_id,
                        userId: userId,
                        createdAt: FieldValue.serverTimestamp(),
                        ...enforcedCategory,
                        propertyId: enforcedCategory.propertyId || null,
                        reviewStatus: 'needs-review',
                    };

                    batch.set(docRef, txData, { merge: true });

                    // Increment stats only if a property is linked
                    if (txData.propertyId) {
                        incrementPropertyStats({
                            propertyId: txData.propertyId,
                            date: txData.date,
                            amount: txData.amount,
                            userId: userId,
                        }).catch(console.error);
                    }
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
            historicalDataPending: true,
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

    
