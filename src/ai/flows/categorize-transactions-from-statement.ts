
'use server';

import { ai } from '@/ai/genkit';
import {
  StatementInput,
  StatementOutput,
  StatementInputSchema,
  StatementOutputSchema,
} from './schemas';
import { MasterCategoryFramework } from './category-framework';
import { initializeServerFirebase, getUserCategoryMappings } from '@/ai/utils';
import { DocumentData } from 'firebase-admin/firestore';

export async function categorizeTransactionsFromStatement(input: StatementInput): Promise<StatementOutput> {
  return categorizeTransactionsFromStatementFlow(input);
}

const extractAndCategorizePrompt = ai.definePrompt({
  name: 'extractAndCategorizePrompt',
  input: { schema: StatementInputSchema },
  output: { schema: StatementOutputSchema },
  prompt: `You are a world-class financial bookkeeping expert specializing in AI-powered transaction extraction and categorization from financial statements.
Your task is to analyze the provided financial statement (PDF or CSV), extract every single transaction, and classify each one with extreme accuracy according to the provided three-level Master Category Framework.

**Context:**
You are performing bookkeeping for a business in the **{{{userTrade}}}** industry. 
Use this context to infer the business purpose of ambiguous transactions (e.g., materials, software, travel).

**User's Custom Rules (These are the source of truth and MUST be followed):**
{{{userMappings}}}

**Master Category Framework (Use this if no custom rule applies):**
${MasterCategoryFramework}
  
**Financial Statement File (or CSV data):**
{{media url=statementDataUri}}

**Your Instructions:**
1.  **Prioritize Custom Rules**: First, check if a transaction description matches any of the user's custom rules. If it does, you MUST use the specified category.
2.  **Use Master Framework**: If no custom rule applies, thoroughly scan the document and extract every transaction.
3.  For each transaction, you must extract:
    - **date**: In YYYY-MM-DD format. If the file is a CSV with a date column, use that.
    - **description**: The full transaction description.
    - **amount**: A number. Expenses must be negative, and income/credits must be positive.
4.  For each extracted transaction, categorize it into the most specific subcategory from the Master Category Framework.
5.  Return a single JSON object containing a "transactions" array. Each object in the array must conform to the output schema, containing the extracted data and the three-level categorization.
**CRITICAL:** If the document is unreadable, password-protected, a blurry image, empty, or if you cannot extract any transactions for any reason, your one and only task is to return a single JSON object with an empty "transactions" array, like this: \`{"transactions": []}\`. You are strictly forbidden from creating, inventing, or hallucinating any sample data. Your entire output MUST be only the empty array structure if you cannot read the file.
`,
});

const categorizeTransactionsFromStatementFlow = ai.defineFlow(
  {
    name: 'categorizeTransactionsFromStatementFlow',
    inputSchema: StatementInputSchema,
    outputSchema: StatementOutputSchema,
  },
  async (input) => {
    const { firestore } = initializeServerFirebase();

    // 1. Get User Profile for Trade/Context
    const userProfileSnap = await firestore.collection('users').doc(input.userId).get();
    const userTrade = userProfileSnap.exists ? userProfileSnap.data()?.trade : 'General Business';
    
    // 2. Get Custom Category Rules
    const userMappings = await getUserCategoryMappings(firestore, input.userId);
    
    // 3. [NEW] Build the "Property Dossier"
    const propertiesSnapshot = await firestore.collection('properties').where('userId', '==', input.userId).get();
    const propertyDossier: any[] = [];
    propertiesSnapshot.forEach(doc => {
      const data = doc.data();
      propertyDossier.push({
        id: doc.id,
        name: data.name,
        address: data.address,
        tenants: data.tenants?.map((t: any) => `${t.firstName} ${t.lastName}`) || [],
        lender: data.mortgage?.lenderName,
      });
    });

    const flowInput = { 
        ...input, 
        userMappings, 
        userTrade 
    };
    
    // 4. AI Does the Thinking (Returns Generic Text categories)
    const { output } = await extractAndCategorizePrompt(flowInput);
    if (!output || !output.transactions) return { transactions: [] };

    // 5. THE BRIDGE: Convert Text -> Account IDs using the Dossier
    const resolvedTransactions = await Promise.all(output.transactions.map(async (tx) => {
        
        // A. [NEW] Find the Property ID using Deep Context
        const lowerCaseDesc = tx.description.toLowerCase();
        let matchedPropertyId: string | null = null;
        
        for (const prop of propertyDossier) {
          // Match by Tenant Name (for rent payments)
          if (prop.tenants.some((tenant: string) => lowerCaseDesc.includes(tenant.toLowerCase()))) {
            matchedPropertyId = prop.id;
            break; 
          }
          // Match by Lender Name (for mortgage payments)
          if (prop.lender && lowerCaseDesc.includes(prop.lender.toLowerCase())) {
            matchedPropertyId = prop.id;
            break;
          }
          // Match by Address (fallback for general expenses)
          if (prop.address?.street && lowerCaseDesc.includes(prop.address.street.toLowerCase())) {
            matchedPropertyId = prop.id;
            break;
          }
        }
        
        // B. Find the Account ID based on the Category Name and (now known) Property
        const resolvedAccount = await resolveAccountId(
            firestore, 
            input.userId, 
            matchedPropertyId, // Use the matched property ID
            tx.subcategory
        );

        return {
            ...tx,
            accountId: resolvedAccount?.id || undefined, 
            accountName: resolvedAccount?.name || undefined, // ADD THIS
            status: resolvedAccount ? 'ready' : 'review' 
        };
    }));

    return { transactions: resolvedTransactions };
  }
);

// --- THE UPGRADED RESOLVER FUNCTION ---
async function resolveAccountId(firestore: any, userId: string, propertyId: string | null, categoryName: string): Promise<{ id: string, name: string } | null> {
    const accountsRef = firestore.collection('accounts');
    
    // 1. Build Query: Search all accounts for this user
    // (If propertyId exists, we restrict search. If null, we search everything).
    let query = accountsRef.where('userId', '==', userId);
    if (propertyId) {
        query = query.where('propertyId', '==', propertyId);
    }

    const snapshot = await query.get();
    
    let bestMatchId = null;
    let bestMatchScore = 0;

    // 2. Keyword Mapping (AI Term -> Likely Ledger Words)
    const keywordMap: Record<string, string[]> = {
        // INCOME
        "Rental Income": ["Rent", "Lease", "Income"],
        "Interest Income": ["Interest"],
        
        // EXPENSES - REPAIRS & OPS
        "Repairs & Maintenance": ["Maint", "Repair", "Fix", "Ops", "Contractor", "Handyman"],
        "Cleaning Services": ["Maint", "Ops", "Cleaning", "Janitorial", "Make Ready"], // <--- FIX FOR POOL CLEANING
        "Landscaping": ["Maint", "Ops", "Landscap", "Lawn", "Yard"], 
        "Contractor Payments (non-COGS)": ["Contractor", "Labor", "Service", "Maint"],
        
        // EXPENSES - UTILITIES
        "Utilities (Electricity, Water, Gas)": ["Utilities", "Electric", "Water", "Gas", "Power", "Edison", "Atmos", "City"],
        
        // EXPENSES - ADMIN
        "Office Rent": ["Rent", "Lease", "Office"],
        "General & Administrative": ["Gen", "Admin", "Office", "Software", "Supplies"],
        "Professional Services": ["Legal", "Professional", "CPA", "Accounting"],
        
        // LIABILITIES / EQUITY
        "Owner’s Draw": ["Draw", "Distribution", "Equity"],
        "Mortgage Interest": ["Mortgage", "Loan", "Interest"], 
        "Property Taxes": ["Tax", "County", "City"],
        "Insurance": ["Insurance", "Policy"]
    };

    // Get the list of words to look for (or just use the category name itself)
    // We clean the categoryName to remove special chars like ">" or "("
    const cleanCategory = categoryName.split('>').pop()?.trim() || categoryName;
    const searchTerms = keywordMap[cleanCategory] || keywordMap[categoryName] || [cleanCategory];

    snapshot.forEach((doc: DocumentData) => {
        const data = doc.data();
        const accountName = (data.name || "").toLowerCase();
        const accountSubtype = (data.subtype || "").toLowerCase();
        
        // Priority 1: Exact Subtype Match (e.g. "Rental Income" == "Rental Income")
        if (accountSubtype === cleanCategory.toLowerCase()) {
            if (bestMatchScore < 100) {
                bestMatchId = doc.id;
                bestMatchScore = 100;
            }
        }

        // Priority 2: Name contains a Keyword (e.g. "Rent - Talia Cir" contains "Rent")
        for (const term of searchTerms) {
            const cleanTerm = term.toLowerCase();
            if (accountName.includes(cleanTerm)) {
                // If we found a match, but haven't found a "Priority 1" match yet, take this.
                if (bestMatchScore < 50) {
                     bestMatchId = doc.id;
                     bestMatchScore = 50;
                }
            }
        }
    });

    if (bestMatchId) {
        // Find the doc again to get the name (or store it during the loop)
        const doc = snapshot.docs.find((d:any) => d.id === bestMatchId);
        return { id: bestMatchId, name: doc.data().name };
    }
    return null;
}
