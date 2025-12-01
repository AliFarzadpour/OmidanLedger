'use server';

/**
 * @fileOverview An AI agent that categorizes transactions from bank or credit card statements.
 *
 * - categorizeTransactions - A function that handles the transaction categorization process.
 * - CategorizeTransactionsInput - The input type for the categorizeTransactions function.
 * - CategorizeTransactionsOutput - The return type for the categorizeTransactions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CategorizeTransactionsInputSchema = z.object({
  transactionDescription: z
    .string()
    .describe('The description of the transaction from the bank or credit card statement.'),
});
export type CategorizeTransactionsInput = z.infer<typeof CategorizeTransactionsInputSchema>;

const CategorizeTransactionsOutputSchema = z.object({
  category: z
    .string()
    .describe(
      'The category of the transaction (e.g., Groceries, Utilities, Dining, Travel).' + 
      'Use a single word or short phrase for the category.'
    ),
  confidence: z
    .number()
    .describe('The confidence level (0-1) of the categorization, with 1 being the most confident.'),
});
export type CategorizeTransactionsOutput = z.infer<typeof CategorizeTransactionsOutputSchema>;

export async function categorizeTransactions(input: CategorizeTransactionsInput): Promise<CategorizeTransactionsOutput> {
  return categorizeTransactionsFlow(input);
}

const categorizeTransactionsPrompt = ai.definePrompt({
  name: 'categorizeTransactionsPrompt',
  input: {schema: CategorizeTransactionsInputSchema},
  output: {schema: CategorizeTransactionsOutputSchema},
  prompt: `You are a personal finance expert specializing in categorizing transactions.

You will be provided with a transaction description from a bank or credit card statement.
Your task is to categorize the transaction into one of the following categories: Groceries, Utilities, Dining, Travel, Entertainment, Shopping, Bills, Income, Other.

Transaction Description: {{{transactionDescription}}}

Respond with JSON that contains the "category" and "confidence" (between 0 and 1) fields. Be as accurate as possible.
`, 
});

const categorizeTransactionsFlow = ai.defineFlow(
  {
    name: 'categorizeTransactionsFlow',
    inputSchema: CategorizeTransactionsInputSchema,
    outputSchema: CategorizeTransactionsOutputSchema,
  },
  async input => {
    const {output} = await categorizeTransactionsPrompt(input);
    return output!;
  }
);
