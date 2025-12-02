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

export async function categorizeTransactionsFromStatement(input: StatementInput): Promise<StatementOutput> {
  return categorizeTransactionsFromStatementFlow(input);
}

const extractAndCategorizePrompt = ai.definePrompt({
  name: 'extractAndCategorizePrompt',
  input: {schema: StatementInputSchema},
  output: {schema: StatementOutputSchema},
  prompt: `You are a world-class financial bookkeeping expert specializing in AI-powered transaction extraction and categorization from financial statements.
Your task is to analyze the provided financial statement (PDF or CSV), extract every single transaction, and classify each one with extreme accuracy according to the provided three-level Master Category Framework.

**Master Category Framework:**
${MasterCategoryFramework}
  
**Financial Statement File:**
{{media url=statementDataUri}}

**Your Instructions:**
1.  Thoroughly scan the document and extract every transaction.
2.  For each transaction, you must extract:
    - **date**: In YYYY-MM-DD format.
    - **description**: The full transaction description.
    - **amount**: A number. Expenses must be negative, and income/credits must be positive.
3.  For each extracted transaction, categorize it into the most specific subcategory from the Master Category Framework.
4.  Return a single JSON object containing a "transactions" array. Each object in the array must conform to the output schema, containing the extracted data and the three-level categorization.
`,
});

const categorizeTransactionsFromStatementFlow = ai.defineFlow(
  {
    name: 'categorizeTransactionsFromStatementFlow',
    inputSchema: StatementInputSchema,
    outputSchema: StatementOutputSchema,
  },
  async (input) => {
    const { output } = await extractAndCategorizePrompt(input);
    return output!;
  }
);
