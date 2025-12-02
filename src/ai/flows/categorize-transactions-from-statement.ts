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
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, getApps } from 'firebase-admin/app';

// Initialize Firebase Admin SDK if not already initialized
if (!getApps().length) {
  initializeApp();
}

async function getUserCategoryMappings(userId: string): Promise<string> {
    const db = getFirestore();
    const mappingsSnapshot = await db.collection(`users/${userId}/categoryMappings`).get();
    if (mappingsSnapshot.empty) {
        return "No custom mappings provided.";
    }
    const mappings = mappingsSnapshot.docs.map(doc => {
        const data = doc.data();
        return `- Description: "${data.transactionDescription}" -> Category: ${data.primaryCategory} > ${data.secondaryCategory} > ${data.subcategory}`;
    });
    return mappings.join('\n');
}


export async function categorizeTransactionsFromStatement(input: StatementInput): Promise<StatementOutput> {
  return categorizeTransactionsFromStatementFlow(input);
}

const extractAndCategorizePrompt = ai.definePrompt({
  name: 'extractAndCategorizePrompt',
  input: {schema: StatementInputSchema},
  output: {schema: StatementOutputSchema},
  prompt: `You are a world-class financial bookkeeping expert specializing in AI-powered transaction extraction and categorization from financial statements.
Your task is to analyze the provided financial statement (PDF or CSV), extract every single transaction, and classify each one with extreme accuracy according to the provided three-level Master Category Framework.

**User's Custom Rules (These are the source of truth and MUST be followed):**
{{{userMappings}}}

**Master Category Framework (Use this if no custom rule applies):**
${MasterCategoryFramework}
  
**Financial Statement File:**
{{media url=statementDataUri}}

**Your Instructions:**
1.  **Prioritize Custom Rules**: First, check if a transaction description matches any of the user's custom rules. If it does, you MUST use the specified category.
2.  **Use Master Framework**: If no custom rule applies, thoroughly scan the document and extract every transaction.
3.  For each transaction, you must extract:
    - **date**: In YYYY-MM-DD format.
    - **description**: The full transaction description.
    - **amount**: A number. Expenses must be negative, and income/credits must be positive.
4.  For each extracted transaction, categorize it into the most specific subcategory from the Master Category Framework.
5.  Return a single JSON object containing a "transactions" array. Each object in the array must conform to the output schema, containing the extracted data and the three-level categorization.
`,
});

const categorizeTransactionsFromStatementFlow = ai.defineFlow(
  {
    name: 'categorizeTransactionsFromStatementFlow',
    inputSchema: StatementInputSchema,
    outputSchema: StatementOutputSchema,
  },
  async (input) => {
    // We need a way to get the userId. Assuming it's passed in the input for now.
    // This is a placeholder and needs a secure way to get the user ID.
    const auth = getAuth();
    // This is not secure for production, as client can spoof userId.
    // In a real app, you'd get the UID from an authenticated Genkit context.
    const decodedToken = await auth.verifyIdToken(input.userId);
    const userId = decodedToken.uid;
    
    const userMappings = await getUserCategoryMappings(userId);

    const { output } = await extractAndCategorizePrompt({
        ...input,
        userMappings,
    });
    return output!;
  }
);

    