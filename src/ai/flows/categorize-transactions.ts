
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
import { MasterCategoryFramework } from './category-framework';

const CategorizeTransactionsInputSchema = z.object({
  transactionDescription: z
    .string()
    .describe('The description of the transaction from the bank or credit card statement.'),
});
export type CategorizeTransactionsInput = z.infer<typeof CategorizeTransactionsInputSchema>;

const CategorizeTransactionsOutputSchema = z.object({
  primaryCategory: z.string().describe('The top-level category (e.g., "Operating Expenses").'),
  secondaryCategory: z.string().describe('The second-level category (e.g., "Marketing & Advertising").'),
  subcategory: z.string().describe('The most specific, third-level category (e.g., "Google Ads").'),
  confidence: z
    .number()
    .describe('The confidence level (0-1) of the categorization, with 1 being the most confident.'),
  notes: z.string().describe('Any notes about the categorization, like the vendor matched.'),
});
export type CategorizeTransactionsOutput = z.infer<typeof CategorizeTransactionsOutputSchema>;

export async function categorizeTransactions(input: CategorizeTransactionsInput): Promise<CategorizeTransactionsOutput> {
  return categorizeTransactionsFlow(input);
}

const categorizeTransactionsPrompt = ai.definePrompt({
  name: 'categorizeTransactionsPrompt',
  input: {schema: CategorizeTransactionsInputSchema},
  output: {schema: CategorizeTransactionsOutputSchema},
  prompt: `You are a world-class financial bookkeeping expert specializing in AI-powered transaction categorization.
Your task is to analyze a single transaction description and classify it with extreme accuracy according to the provided three-level Master Category Framework.

**Master Category Framework:**
${MasterCategoryFramework}

**Transaction Description:**
{{{transactionDescription}}}

**Your Instructions:**
1.  Analyze the transaction description carefully.
2.  Match it to the most specific subcategory within the Master Category Framework.
3.  Return a JSON object with the exact "primaryCategory", "secondaryCategory", and "subcategory" from the framework.
4.  Provide a confidence score from 0 to 1.
5.  Add a brief note explaining your reasoning (e.g., "Matched with known vendor 'Google Ads Billing'.").
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
