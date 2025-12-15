
'use server';

/**
 * @fileOverview An AI agent that extracts and categorizes transactions from a statement file (PDF or CSV).
 *
 * - categorizeTransactionsFromStatement - A function that handles the transaction extraction and categorization process.
 */

import {ai} from '@/ai/genkit';
import {
    StatementInput,
    StatementOutput,
    StatementInputSchema,
    StatementOutputSchema,
} from './schemas';
import { MasterCategoryFramework } from './category-framework';
import { initializeServerFirebase, getUserCategoryMappings } from '@/ai/utils';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';


export async function categorizeTransactionsFromStatement(input: StatementInput): Promise<StatementOutput> {
  return categorizeTransactionsFromStatementFlow(input);
}

const extractAndCategorizePrompt = ai.definePrompt({
  name: 'extractAndCategorizePrompt',
  input: {schema: StatementInputSchema},
  output: {schema: StatementOutputSchema},
  prompt: `You are a world-class financial bookkeeping expert specializing in AI-powered transaction extraction and categorization from financial statements.
  
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

2.  **Special Handling for Complex Transactions (IMPORTANT):**
    *   **Split Transactions:** If a transaction description contains keywords like "Mortgage", "Loan Pymt", "Insurance Prem", or similar phrases that imply a single payment covers multiple accounting events (e.g., principal, interest, escrow), you MUST categorize it as:
        - primaryCategory: "Needs Review"
        - secondaryCategory: "Needs Review"
        - subcategory: "Needs Review - Split Transaction"
    *   **Unclear Descriptions:** If a description is too generic to be useful (e.g., "CHECK #1024", "ACH DEBIT", "POS TRANSACTION"), you MUST categorize it as:
        - primaryCategory: "Needs Review"
        - secondaryCategory: "Needs Review"
        - subcategory: "Needs Review - Unclear Description"

3.  **Standard Categorization**: If no special handling rule applies, thoroughly scan the document and extract every transaction. For each transaction:
    *   **Extract Data**:
        - **date**: In YYYY-MM-DD format.
        - **description**: The full, original transaction description.
        - **amount**: A number. Expenses must be negative, and income/credits must be positive.
    *   **Normalize Description for Matching**: Before matching, mentally strip common unhelpful words from the description like "INC", "LLC", "CORP", "PAYMENT", "DEBIT", "CREDIT". Focus on the core vendor name (e.g., "UBER   TRIP   HELP.UBER.COM" becomes "UBER TRIP").
    *   **Categorize**: Match the normalized description to the most specific subcategory from the Master Category Framework.
    *   **Return**: Provide a single JSON object containing a "transactions" array. Each object in the array must conform to the output schema, containing the extracted data and the three-level categorization.

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

    // 1. Get User Rules & Context
    const userMappings = await getUserCategoryMappings(firestore, input.userId);

    // Fetch User Profile to get the trade
    const userProfileSnap = await getDoc(doc(firestore, 'users', input.userId));
    const userTrade = userProfileSnap.exists() ? userProfileSnap.data().trade : 'General Business';
    
    const flowInput = { 
        ...input, 
        userMappings, 
        userTrade 
    };

    // 2. AI Does the Thinking (Returns Generic Text categories)
    const { output } = await extractAndCategorizePrompt(flowInput);

    if (!output || !output.transactions) return { transactions: [] };

    // 3. THE BRIDGE: Convert Text -> Account IDs
    const resolvedTransactions = await Promise.all(output.transactions.map(async (tx) => {
        
        let propertyId = null; // In a real app, this would be more sophisticated.
        
        const accountId = await resolveAccountId(
            firestore,
            input.userId,
            input.propertyId || null, // Use propertyId from input if available
            tx.subcategory
        );

        return {
            ...tx,
            accountId: accountId || null,
            status: accountId ? 'ready' : 'needs_review'
        };
    }));

    return { transactions: resolvedTransactions };
  }
);


// --- THE RESOLVER FUNCTION ---
async function resolveAccountId(firestore: any, userId: string, propertyId: string | null, categoryName: string): Promise<string | null> {
    // If no property is specified, we can't resolve property-specific accounts.
    // We could add logic here later to check for general, non-property accounts if needed.
    if (!propertyId) return null;

    const accountsRef = collection(firestore, 'accounts');
    
    // Build a query to find accounts for the given user and property.
    const q = query(
        accountsRef,
        where('userId', '==', userId),
        where('propertyId', '==', propertyId)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        return null;
    }
    
    // Find the best match from the results.
    // e.g., AI returns category "Repairs & Maintenance". Account name is "Repairs & Maintenance - 123 Main St"
    const match = snapshot.docs.find(doc => {
        const data = doc.data();
        // Check if the account's name or subtype contains the AI's guessed category.
        // This is a simple but effective matching strategy.
        const nameMatch = data.name?.toLowerCase().includes(categoryName.toLowerCase());
        const subtypeMatch = data.subtype?.toLowerCase().includes(categoryName.toLowerCase());
        return nameMatch || subtypeMatch;
    });

    return match ? match.id : null;
}
