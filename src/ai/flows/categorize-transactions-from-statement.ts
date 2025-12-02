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

export async function categorizeTransactionsFromStatement(input: StatementInput): Promise<StatementOutput> {
  return categorizeTransactionsFromStatementFlow(input);
}

const extractAndCategorizePrompt = ai.definePrompt({
  name: 'extractAndCategorizePrompt',
  input: {schema: StatementInputSchema},
  output: {schema: StatementOutputSchema},
  prompt: `You are an expert financial assistant. Your task is to analyze the provided financial statement (PDF or CSV), extract every transaction, and categorize each one.

  Statement File:
  {{media url=statementDataUri}}
  
  For each transaction you find, extract the date, description, and amount.
  - The date should be in YYYY-MM-DD format.
  - The amount should be a number. Represent expenses as negative numbers and income/credits as positive numbers.
  - Categorize each transaction into one of the following: Groceries, Utilities, Dining, Travel, Entertainment, Shopping, Bills, Income, Other.
  
  Return a JSON object containing a "transactions" array with all the extracted and categorized data.`,
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
