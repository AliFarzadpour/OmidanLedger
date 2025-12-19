
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
  userRules: Array<{
    keyword: string;
    primaryCategory: string;
    secondaryCategory: string;
    subcategory: string;
    propertyId: string | null; // ✅ Allow null
  }>;
}

// 1. ROBUST SANITIZER
function sanitizeVendorId(text: string): string {
  if (!text) return 'UNKNOWN_VENDOR';
  return text.toUpperCase()
    .replace(/\//g, '_')     
    .replace(/\\/g, '_')      
    .replace(/[#\?]/g, '')    
    .replace(/[^\w\s_]/g, '') 
    .replace(/\s+/g, '_')     
    .trim();
}

export async function getCategoryFromDatabase(
  merchantName: string, 
  context: UserContext,
  db: FirebaseFirestore.Firestore
) {
  if (!merchantName) return null;

  const desc = merchantName.toUpperCase();
  const cleanId = sanitizeVendorId(desc);

  // --- A. CHECK USER RULES (IN-MEMORY) - Priority 1 ---
  const matchedRule = context.userRules.find(rule => 
      desc.includes(rule.keyword) 
  );

  if (matchedRule) {
      return { 
          primaryCategory: matchedRule.primaryCategory,
          secondaryCategory: matchedRule.secondaryCategory,
          subcategory: matchedRule.subcategory,
          propertyId: matchedRule.propertyId, // ✅ PASS THE PROPERTY ID
          confidence: 1.0,
          source: 'User Rule' 
      };
  }

  // --- B. CHECK GLOBAL MASTER DATABASE (FIRESTORE) - Priority 2 ---
  try {
      const globalDoc = await db.collection('globalVendorMap').doc(cleanId).get();
      
      if (globalDoc.exists) {
          const data = globalDoc.data();
          return { 
              primaryCategory: data?.primaryCategory || data?.primary,
              secondaryCategory: data?.secondaryCategory || data?.secondary,
              subcategory: data?.subcategory || data?.sub,
              propertyId: data?.propertyId || null,
              confidence: 0.95, 
              source: 'Global DB' 
          };
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
      if (keyword) {
          context.userRules.push({
              keyword: keyword,
              primaryCategory: data.primaryCategory,
              secondaryCategory: data.secondaryCategory,
              subcategory: data.subcategory,
              // ✅ CRITICAL FIX: Default to null if missing
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

async function categorizeBatchWithAI(
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
): Promise<{ primary: string, secondary: string, sub: string, confidence: number }> {
  
  const safeDesc = description || ''; 
  const desc = safeDesc.toUpperCase();
  
  const cleanDesc = desc.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g," ");
  
  const isIncome = amount > 0;
  const { defaultIncomeCategory } = context.business || {};

  if (desc.includes('ONLINE BANKING TRANSFER') || 
      desc.includes('TRANSFER TO CHK') || 
      desc.includes('TRANSFER FROM CHK') || 
      desc.includes('INTERNAL TRANSFER')) {
      return { primary: 'Balance Sheet', secondary: 'Transfers', sub: 'Internal Transfer', confidence: 1.0 };
  }

  if (isIncome) {
      if (desc.includes('RENT') || desc.includes('LEASE')) {
          return { primary: 'Income', secondary: 'Rental Income', sub: 'Residential/Commercial Rent', confidence: 1.0 };
      }
      if (desc.includes('DEPOSIT') && !desc.includes('REFUND')) {
          return { primary: 'Income', secondary: 'Rental Income', sub: 'Security Deposit', confidence: 0.9 };
      }
      if (desc.includes('INTEREST')) {
          return { primary: 'Income', secondary: 'Other Income', sub: 'Interest Income', confidence: 1.0 };
      }
      if (desc.includes('REFUND') || desc.includes('RETURN')) {
           return { primary: 'Income', secondary: 'Uncategorized', sub: 'Refunds/Credits', confidence: 0.8 };
      }
      return { primary: 'Income', secondary: 'Operating Income', sub: defaultIncomeCategory || 'Sales', confidence: 0.7 };
  }
  
  if (desc.includes('PAYMENT - THANK YOU') || desc.includes('PAYMENT RECEIVED') || desc.includes('CREDIT CARD') || desc.includes('LOAN') || desc.includes('MORTGAGE')) {
      return { primary: 'Balance Sheet', secondary: 'Liabilities', sub: 'Loan/Card Payment', confidence: 0.95 };
  }
  
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

  if (desc.includes('RENT') || desc.includes('LEASE')) {
      return { primary: 'Operating Expenses', secondary: 'Rent & Lease', sub: 'Rent Expense', confidence: 0.9 };
  }

  return { primary: 'Operating Expenses', secondary: 'Uncategorized', sub: 'General Expense', confidence: 0.1 };
}

export async function enforceAccountingRules(
  category: any, 
  amount: number
) {
  if (category.source === 'User Rule' || (category.aiExplanation && category.aiExplanation.includes('User Rule'))) {
      return category;
  }
    
  const isIncome = amount > 0;
  
  let final = { ...category };

  if (isIncome && (final.primaryCategory.includes('Expense') || final.primaryCategory === 'Property Expenses' || final.primaryCategory === 'Real Estate')) {
      if (final.subcategory?.includes('Rent') || final.subcategory?.includes('Lease')) {
          final.primaryCategory = 'Income';
          final.secondaryCategory = 'Rental Income';
          final.subcategory = 'Residential Rent';
          final.aiExplanation = 'Forced to Income by Accounting Enforcer (Positive Amount)';
      } 
      else {
          final.primaryCategory = 'Income';
          final.secondaryCategory = 'Uncategorized Income';
      }
  }

  if (final.subcategory === 'Credit Card Payment' || final.subcategory === 'Internal Transfer') {
      final.primaryCategory = 'Balance Sheet';
      if (amount > 0 && final.subcategory === 'Credit Card Payment') {
          final.secondaryCategory = 'Liabilities';
      }
  }

  return final;
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
            return tx.account_id === bankAccountId;
        });

        if (relevantTransactions.length === 0) {
            await accountRef.update({ plaidSyncCursor: cursor, lastSyncedAt: FieldValue.serverTimestamp() });
            return { count: 0 };
        }

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

                    const signedAmount = originalTx.amount * -1;
                    let finalCategory: any;

                    const ruleResult = await getCategoryFromDatabase(originalTx.name, userContext, db);

                    if (ruleResult) {
                        finalCategory = {
                            primaryCategory: ruleResult.primaryCategory,
                            secondaryCategory: ruleResult.secondaryCategory,
                            subcategory: ruleResult.subcategory,
                            confidence: ruleResult.confidence,
                            propertyId: ruleResult.propertyId,
                            aiExplanation: `Matched rule via ${ruleResult.source}`, 
                            merchantName: originalTx.merchant_name || originalTx.name,
                            status: 'posted',
                            source: ruleResult.source
                        };
                    } else {
                        const deepResult = await deepCategorizeTransaction({
                            description: originalTx.name,
                            amount: signedAmount,
                            date: originalTx.date
                        });
                        
                        if (deepResult && deepResult.confidence > 0.7) {
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
                            const heuristicResult = await categorizeWithHeuristics(originalTx.name, signedAmount, originalTx.personal_finance_category, userContext);
                            finalCategory = {
                                primaryCategory: heuristicResult.primary,
                                secondaryCategory: heuristicResult.secondary,
                                subcategory: heuristicResult.sub,
                                confidence: heuristicResult.confidence,
                                aiExplanation: 'Deep AI failed, used standard Rules',
                                merchantName: originalTx.merchant_name || originalTx.name,
                                status: 'review'
                            };
                        }
                    }
                    
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

    



