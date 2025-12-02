'use server';

/**
 * @fileOverview An AI agent that extracts and categorizes transactions from a statement file (PDF or CSV).
 *
 * - categorizeTransactionsFromStatement - A function that handles the transaction extraction and categorization process.
 * - StatementInput - The input type for the categorizeTransactionsFromStatement function.
 * - CategorizedTransaction - The output type for a single categorized transaction.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

export const StatementInputSchema = z.object({
  statementDataUri: z
    .string()
    .describe(
      "The full content of the bank or credit card statement file, as a data URI. It must include a MIME type (e.g., 'data:application/pdf;base64,...' or 'data:text/csv;base64,...')."
    ),
});
export type StatementInput = z.infer<typeof StatementInputSchema>;

export const CategorizedTransactionSchema = z.object({
    date: z.string().describe("The transaction date in YYYY-MM-DD format."),
    description: z.string().describe("A brief description of the transaction."),
    amount: z.number().describe("The transaction amount. Positive for income, negative for expenses."),
    category: z
    .string()
    .describe(
      'The category of the transaction (e.g., Groceries, Utilities, Dining, Travel, Entertainment, Shopping, Bills, Income, Other).'
    ),
});
export type CategorizedTransaction = z.infer<typeof CategorizedTransactionSchema>;


export const StatementOutputSchema = z.object({
    transactions: z.array(CategorizedTransactionSchema),
});
export type StatementOutput = z.infer<typeof StatementOutputSchema>;


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
