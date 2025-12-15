
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

// NOTE: We removed the 'firebase/firestore' imports because we use the Admin SDK syntax now.

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

    // 1. Parallel Fetch: Get Mappings AND User Profile
    // Note: 'getUserCategoryMappings' handles its own logic, assuming it works.
    // We fetch the user profile to get the 'trade'
    const userProfileSnap = await firestore.collection('users').doc(input.userId).get();
    
    // Extract the trade (default to 'General Business' if missing)
    const userTrade = userProfileSnap.exists 
      ? userProfileSnap.data()?.trade 
      : 'General Business';

    const userMappings = await getUserCategoryMappings(firestore, input.userId);
    
    const flowInput = { 
        ...input, 
        userMappings, 
        userTrade 
    };
    
    // 2. AI Does the Thinking (Returns Generic Text categories)
    const { output } = await extractAndCategorizePrompt(flowInput);
    
    if (!output || !output.transactions) return { transactions: [] };

    // 3. THE BRIDGE: Convert Text -> Account IDs
    // We iterate through every transaction the AI found and find the real ledger.
    const resolvedTransactions = await Promise.all(output.transactions.map(async (tx) => {
        
        // A. Find the Property ID 
        // In this iteration, we don't have the logic to extract propertyId from the statement yet.
        // You can pass it in 'input' if you are uploading for a specific property.
        // For now, we will pass null, which means 'resolveAccountId' will likely return null 
        // unless you upgrade this logic later.
        let propertyId = null; 
        
        // B. Find the Account ID based on the Category Name
        const accountId = await resolveAccountId(
            firestore, 
            input.userId, 
            propertyId, 
            tx.subcategory // e.g., "Repairs & Maintenance"
        );

        return {
            ...tx,
            accountId: accountId || undefined, // Attach the real DB ID
            status: accountId ? 'ready' : 'review' // If no ID found, flag for human
        };
    }));

    return { transactions: resolvedTransactions };
  }
);

// --- THE RESOLVER FUNCTION (ADMIN SDK SYNTAX) ---
async function resolveAccountId(firestore: any, userId: string, propertyId: string | null, categoryName: string) {
    if (!propertyId) return null; 

    // Admin SDK Syntax: db.collection().where().get()
    const accountsRef = firestore.collection('accounts');
    
    // Note: We cannot query if propertyId is null, so we guarded against it above.
    const snapshot = await accountsRef
        .where('userId', '==', userId)
        .where('propertyId', '==', propertyId)
        .get();
    
    // Simple Matcher: Find the account where the name or subtype contains the category
    let matchId = null;
    
    snapshot.forEach((doc: any) => {
        const data = doc.data();
        if (data.subtype === categoryName || data.name.includes(categoryName)) {
            matchId = doc.id;
        }
    });

    return matchId;
}
