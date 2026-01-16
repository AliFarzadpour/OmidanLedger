
import { PlaidLinkOnSuccessMetadata } from 'react-plaid-link';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { deepCategorizeTransaction } from '@/ai/flows/deep-categorize-transaction';
import type { TransactionCategorySchema } from '@/lib/prompts/categorization';
import { CATEGORY_MAP, L0Category } from '@/lib/categories';
import { Firestore } from 'firebase-admin/firestore';

/**
 * Creates a Plaid Link Token.
 * Supports both NEW connections and UPDATE mode (Re-linking) if an accessToken is provided.
 */
export async function createLinkToken({ 
  userId, 
  accessToken, 
  daysRequested 
}: { 
  userId: string; 
  accessToken?: string; 
  daysRequested?: number; 
}) {
  const response = await fetch('/api/plaid/create-link-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      userId, 
      accessToken, 
      daysRequested 
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create link token');
  }

  const data = await response.json();
  return data.link_token;
}

/**
 * Exchanges a public_token for a permanent access_token.
 * Now correctly typed to accept userId and accountId for database updates.
 */
export async function exchangePublicToken({ 
  publicToken,
  userId,
  accountId
}: { 
  publicToken: string;
  userId: string;
  accountId?: string;
}) {
  const response = await fetch('/api/plaid/exchange-public-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ publicToken, userId, accountId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to exchange token');
  }
  
  return await response.json();
}

/**
 * Saves bank account details to Firestore via backend.
 * IMPORTANT: This sends a *publicToken* (NOT accessToken).
 */
export async function createBankAccountFromPlaid({
  userId,
  publicToken,
  metadata,
}: {
  userId: string;
  publicToken: string;
  metadata: PlaidLinkOnSuccessMetadata;
}) {
  const response = await fetch('/api/plaid/save-account', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, publicToken, metadata }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to save account to database');
  }

  return await response.json();
}

/**
 * Syncs transactions for a specific bank account.
 * Optional: pass startDate for backfill (YYYY-MM-DD).
 */
export async function syncAndCategorizePlaidTransactions({
  userId,
  bankAccountId,
  fullSync,
  startDate,
}: {
  userId: string;
  bankAccountId: string;
  fullSync?: boolean;
  startDate?: string;
}) {
  const response = await fetch('/api/plaid/sync-transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, bankAccountId, fullSync, startDate }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to sync transactions');
  }

  return await response.json();
}

// --- INTELLIGENT CATEGORIZATION ENGINE ---

type UserContext = {
  userId: string;
  userRules: any[];
  globalRules: any[];
};

export async function fetchUserContext(db: Firestore, userId: string): Promise<UserContext> {
  const [userRulesSnap, globalRulesSnap] = await Promise.all([
    db.collection(`users/${userId}/categoryMappings`).get(),
    db.collection('globalVendorMap').get()
  ]);

  return {
    userId,
    userRules: userRulesSnap.docs.map((doc: any) => doc.data()),
    globalRules: globalRulesSnap.docs.map((doc: any) => doc.data()),
  };
}

export async function getCategoryFromDatabase(description: string, context: UserContext): Promise<any | null> {
  const descLower = description.toLowerCase();
  
  // 1. Check User's Personal Rules (Highest Priority)
  for (const rule of context.userRules) {
    const keyword = rule.transactionDescription || rule.originalKeyword;
    if (keyword && descLower.includes(keyword.toLowerCase())) {
      return { 
        ...rule.categoryHierarchy,
        confidence: 0.99, // User rule match is very high confidence
        explanation: `Matched user rule: '${keyword}'`,
        costCenter: rule.propertyId, // Return the cost center
      };
    }
  }

  // 2. Check Global Vendor Map
  for (const rule of context.globalRules) {
    const keyword = rule.originalKeyword;
    if (keyword && descLower.includes(keyword.toLowerCase())) {
       return { 
        l0: rule.categoryHierarchy.l0,
        l1: rule.categoryHierarchy.l1,
        l2: rule.categoryHierarchy.l2,
        l3: rule.categoryHierarchy.l3,
        confidence: 0.95, 
        explanation: `Matched global rule: '${keyword}'`
      };
    }
  }

  return null;
}


export async function categorizeWithHeuristics(
  description: string,
  amount: number,
  plaidCategory: any | null,
  userContext: UserContext
): Promise<Partial<TransactionCategorySchema & { costCenter?: string }>> {
  
  // 1. Database-driven rules (Highest Priority)
  const dbResult = await getCategoryFromDatabase(description, userContext);
  if (dbResult) {
    return {
      primaryCategory: dbResult.l0,
      secondaryCategory: dbResult.l1,
      subcategory: dbResult.l2,
      confidence: dbResult.confidence,
      explanation: dbResult.explanation,
      costCenter: dbResult.costCenter,
    } as Partial<TransactionCategorySchema & { costCenter?: string }>;
  }

  // 2. Heuristic Rules (Keyword-based)
  const descLower = description.toLowerCase();

  // Rule: Zelle payments are often transfers or contractor payments
  if (descLower.includes('zelle')) {
    if (amount > 0) { // Incoming money
      return { primaryCategory: 'Income', secondaryCategory: 'Rental Income', subcategory: 'Line 3: Rents Received', confidence: 0.8, explanation: "Zelle payment received, likely rent." };
    } else { // Outgoing money
      return { primaryCategory: 'OPERATING EXPENSE', secondaryCategory: 'Property Operations (Rentals)', subcategory: 'Line 11: Contract Labor', confidence: 0.75, explanation: "Zelle payment to a person, likely a contractor." };
    }
  }

  // Rule: Hardware stores are repairs
  if (['home depot', 'lowe\'s', 'ace hardware'].some(v => descLower.includes(v))) {
    return { primaryCategory: 'OPERATING EXPENSE', secondaryCategory: 'Property Operations (Rentals)', subcategory: 'Line 14: Repairs', confidence: 0.9, explanation: "Hardware store purchase." };
  }

  // 3. Fallback to Deep AI Analysis
  try {
    const aiResult = await deepCategorizeTransaction({
      description,
      amount,
      date: new Date().toISOString().split('T')[0] // Pass current date as context
    });
    
    if (aiResult) {
      return {
        primaryCategory: aiResult.categoryHierarchy.l0,
        secondaryCategory: aiResult.categoryHierarchy.l1,
        subcategory: aiResult.categoryHierarchy.l2,
        confidence: aiResult.confidence,
        explanation: aiResult.reasoning,
      } as Partial<TransactionCategorySchema>;
    }
  } catch (e) {
    console.error("AI categorization fallback failed:", e);
    // Continue to default if AI fails
  }

  // 4. Absolute Fallback (Default)
  const defaultCategory = amount > 0 
    ? { l0: 'INCOME', l1: 'Other Income', l2: 'Other Income — Miscellaneous Income' }
    : { l0: 'OPERATING EXPENSE', l1: 'Property Operations (Rentals)', l2: 'Schedule E, Line 19 — Other' };

  return {
    primaryCategory: defaultCategory.l0,
    secondaryCategory: defaultCategory.l1,
    subcategory: defaultCategory.l2,
    confidence: 0.1, // Very low confidence
    explanation: 'Default category assigned. Please review.',
  } as Partial<TransactionCategorySchema>;
}
