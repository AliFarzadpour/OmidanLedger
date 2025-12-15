
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
    const userMappings = await getUserCategoryMappings(firestore, input.userId);
    const flowInput = { ...input, userMappings };
    const { output } = await extractAndCategorizePrompt(flowInput);
    return output!;
  }
);
