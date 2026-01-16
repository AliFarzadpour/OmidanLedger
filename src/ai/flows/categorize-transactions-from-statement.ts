
'use server';

import { ai } from '@/ai/genkit';
import {
  StatementInput,
  StatementOutput,
  StatementInputSchema,
  StatementOutputSchema,
} from './schemas';
import { CATEGORY_MAP } from '@/lib/categories';
import { getAdminFirestore } from '@/ai/utils';
import type { Firestore } from 'firebase-admin/firestore';

async function getUserCategoryMappings(firestore: Firestore, userId: string): Promise<string> {
    const mappingsSnapshot = await firestore.collection(`users/${userId}/categoryMappings`).get();
    if (mappingsSnapshot.empty) {
        return "No custom mappings provided.";
    }
    const mappings = mappingsSnapshot.docs.map(doc => {
        const data = doc.data();
        // Fallback for older rule structure
        const cats = data.categoryHierarchy || {l0: data.primaryCategory, l1: data.secondaryCategory, l2: data.subcategory};
        return `- If the transaction description contains "${data.transactionDescription}", you MUST categorize it as: ${cats.l0} > ${cats.l1} > ${cats.l2}`;
    });
    return mappings.join('\n');
}

// NOTE: We use Admin SDK syntax (db.collection) here

export async function categorizeTransactionsFromStatement(input: StatementInput): Promise<StatementOutput> {
  return categorizeTransactionsFromStatementFlow(input);
}

const extractAndCategorizePrompt = ai.definePrompt({
  name: 'extractAndCategorizePrompt',
  input: { schema: StatementInputSchema },
  output: { schema: StatementOutputSchema },
  prompt: `You are a world-class financial bookkeeping expert specializing in AI-powered transaction extraction and categorization.
Your task is to analyze the provided financial statement, extract every transaction, and classify each one with extreme accuracy according to the Master Category Framework.

**Context:**
You are performing bookkeeping for a business in the **{{{userTrade}}}** industry. 
Use this context to infer the business purpose of ambiguous transactions.

**User's Custom Rules (Source of Truth):**
{{{userMappings}}}

**Master Category Framework (MUST use these exact strings):**
${JSON.stringify(CATEGORY_MAP, null, 2)}
  
**Financial Statement File:**
{{media url=statementDataUri}}

**Instructions:**
1. **Prioritize Custom Rules**: Check user rules first.
2. **Extract Data**: 
    - date (YYYY-MM-DD)
    - description (Full text)
    - amount (Negative for expenses, Positive for income)
3. **Categorize**: Map to the specific Master Framework subcategory.
4. **Return JSON**: A "transactions" array matching the schema. If the file is unreadable, return {"transactions": []}.
`,
});

const categorizeTransactionsFromStatementFlow = ai.defineFlow(
  {
    name: 'categorizeTransactionsFromStatementFlow',
    inputSchema: StatementInputSchema,
    outputSchema: StatementOutputSchema,
  },
  async (input) => {
    const firestore = getAdminFirestore();

    // 1. Fetch User Data
    const userProfileSnap = await firestore.collection('users').doc(input.userId).get();
    const userTrade = userProfileSnap.exists ? userProfileSnap.data()?.trade : 'General Business';
    const userMappings = await getUserCategoryMappings(firestore, input.userId);
    
    // 2. Fetch Property Context
    const propsSnap = await firestore.collection('properties').where('userId', '==', input.userId).get();
    
    const propertyIndex = propsSnap.docs.map((d:any) => {
        const data = d.data();
        const keywords = [];
        if (data.name) keywords.push(data.name.toLowerCase());
        if (data.address?.street) {
            keywords.push(data.address.street.toLowerCase());
            const parts = data.address.street.split(' ');
            if (parts.length > 1) keywords.push(parts[1].toLowerCase()); 
        }
        if (data.mortgage?.lenderName) keywords.push(data.mortgage.lenderName.toLowerCase());
        if (data.tenants && Array.isArray(data.tenants)) {
            data.tenants.forEach((t:any) => {
                if (t.firstName) keywords.push(t.firstName.toLowerCase());
                if (t.lastName) keywords.push(t.lastName.toLowerCase());
                if (t.firstName && t.lastName) keywords.push(`${t.firstName} ${t.lastName}`.toLowerCase());
            });
        }
        return {
            id: d.id,
            keywords: keywords.filter((k: string) => k.length > 2)
        };
    });

    const flowInput = { ...input, userMappings, userTrade };
    
    // 3. AI Categorization
    const { output } = await extractAndCategorizePrompt(flowInput);
    
    if (!output || !output.transactions) return { transactions: [] };

    // 4. THE STRICT BRIDGE
    const resolvedTransactions = await Promise.all(output.transactions.map(async (tx) => {
        
        // A. Identify Property
        let matchedPropertyId = null;
        const descLower = tx.description.toLowerCase();
        
        for (const prop of propertyIndex) {
            for (const keyword of prop.keywords) {
                if (descLower.includes(keyword)) {
                    matchedPropertyId = prop.id;
                    break; 
                }
            }
            if (matchedPropertyId) break; 
        }

        // B. Find the Account ID (Now passing 'amount' for safety check)
        const resolvedAccount = await resolveAccountId(
            firestore, 
            input.userId, 
            matchedPropertyId, 
            tx.subcategory,
            tx.amount // <--- NEW: Pass amount to check Income vs Expense
        );

        return {
            ...tx,
            accountId: resolvedAccount?.id || undefined,
            accountName: resolvedAccount?.name || undefined,
            status: resolvedAccount ? 'ready' : 'review' 
        };
    }));

    return { transactions: resolvedTransactions };
  }
);

// --- STRICT RESOLVER FUNCTION ---
async function resolveAccountId(firestore: any, userId: string, propertyId: string | null, categoryName: string, amount: number) {
    const accountsRef = firestore.collection('accounts');
    
    // 1. Base Query
    let query = accountsRef.where('userId', '==', userId);
    
    // 2. Strict Property Scope
    if (propertyId) {
        query = query.where('propertyId', '==', propertyId);
    }
    // IMPORTANT: If propertyId is NULL (we didn't find "Dallas" in your properties),
    // we fetch ALL accounts, but we will FILTER OUT specific property accounts later.

    const snapshot = await query.get();
    
    let bestMatchId = null;
    let bestMatchName = "";
    let bestMatchScore = 0;

    const keywordMap: Record<string, string[]> = {
        "Rental Income": ["Rent", "Lease", "Income"],
        "Interest Income": ["Interest"],
        "Repairs & Maintenance": ["Maint", "Repair", "Fix", "Ops", "Contractor", "Handyman"],
        "Cleaning Services": ["Maint", "Ops", "Cleaning", "Janitorial", "Make Ready"],
        "Landscaping": ["Maint", "Ops", "Landscap", "Lawn", "Yard"], 
        "Contractor Payments (non-COGS)": ["Contractor", "Labor", "Service", "Maint"],
        "Utilities (Electricity, Water, Gas)": ["Utilities", "Electric", "Water", "Gas", "Power", "Edison", "Atmos", "City"],
        "Office Rent": ["Rent", "Lease", "Office"],
        "General & Administrative": ["Gen", "Admin", "Office", "Software", "Supplies"],
        "Professional Services": ["Legal", "Professional", "CPA", "Accounting"],
        "Owner’s Draw": ["Draw", "Distribution", "Equity"],
        "Mortgage Interest": ["Mortgage", "Loan", "Interest"], 
        "Property Taxes": ["Tax", "County", "City"],
        "Insurance": ["Insurance", "Policy"]
    };

    const cleanCategory = categoryName.split('>').pop()?.trim() || categoryName;
    const searchTerms = keywordMap[cleanCategory] || keywordMap[categoryName] || [cleanCategory];
    
    // Detect expected account type
    const isIncome = amount > 0;

    snapshot.forEach((doc: any) => {
        const data = doc.data();
        
        // --- SAFETY CHECK 1: The "Stranger Danger" Rule ---
        // If we didn't identify a property from the description (propertyId is null),
        // we CANNOT assign this to a ledger that belongs to a specific property.
        // We only allow assignment to "Global" accounts (where propertyId is missing).
        // (If you want to allow "guessing" the only property, remove this block, but that caused your bug).
        if (!propertyId && data.propertyId) {
            return; // Skip this account. It belongs to a house, and we don't know which one.
        }

        // --- SAFETY CHECK 2: The "Income/Expense" Rule ---
        // Don't match "Interest Income" ($1.92) to "Mortgage Interest Expense" account.
        // Simple check: Account Type vs Transaction Sign
        if (isIncome && data.type === 'Expense') return; // Don't put income in expense ledger
        if (!isIncome && data.type === 'Income') return; // Don't put expense in income ledger

        const accountName = (data.name || "").toLowerCase();
        const accountSubtype = (data.subtype || "").toLowerCase();
        
        // Priority 1: Exact Subtype
        if (accountSubtype === cleanCategory.toLowerCase()) {
            if (bestMatchScore < 100) {
                bestMatchId = doc.id;
                bestMatchName = data.name;
                bestMatchScore = 100;
            }
        }

        // Priority 2: Keyword Match
        for (const term of searchTerms) {
            if (accountName.includes(term.toLowerCase())) {
                // If we are scoped to a specific property, matches are trustworthy (90).
                // If we are global, matches are riskier (50).
                const score = propertyId ? 90 : 50; 
                if (bestMatchScore < score) {
                     bestMatchId = doc.id;
                     bestMatchName = data.name;
                     bestMatchScore = score;
                }
            }
        }
    });

    if (bestMatchId) return { id: bestMatchId, name: bestMatchName };
    return null;
}
