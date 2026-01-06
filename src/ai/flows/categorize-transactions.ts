
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
import { CATEGORY_MAP } from '@/lib/categories';
import { initializeServerFirebase } from '@/ai/utils';
import { doc, getDoc } from 'firebase/firestore';

const CategorizeTransactionsInputSchema = z.object({
  transactionDescription: z
    .string()
    .describe('The description of the transaction from the bank or credit card statement.'),
  userId: z.string().describe("The user's Firebase UID."),
  userTrade: z.string().optional().describe('The industry or trade of the business (e.g., "Plumber", "Landlord").'),
});
export type CategorizeTransactionsInput = z.infer<typeof CategorizeTransactionsInputSchema>;

const CategorizeTransactionsOutputSchema = z.object({
  primaryCategory: z.string().describe("Level 0: Major Type (e.g., 'Expenses')"),
  secondaryCategory: z.string().describe("Level 1: Financial Category (e.g., 'Repairs')"),
  subcategory: z.string().describe("Level 2: Tax/Schedule E Category (e.g., 'Line 14 Repairs')"),
  details: z.string().describe("Level 3: User-specific details (e.g., 'Adelyn - HVAC Repair')"),
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
  prompt: `You are a world-class real estate bookkeeping expert specializing in AI-powered transaction categorization for tax purposes (Schedule E).
Your task is to analyze a single transaction description and classify it with extreme accuracy according to the provided 4-level Master Category Framework.

**Context:**
The business operates in the **{{{userTrade}}}** industry.

**Master Category Framework (MUST use these exact strings):**
${JSON.stringify(CATEGORY_MAP, null, 2)}

**Transaction Description:**
{{{transactionDescription}}}

**Your Instructions:**
1.  Analyze the transaction description carefully.
2.  Match it to the most specific category within the Master Category Framework.
3.  Return a JSON object with the exact "primaryCategory", "secondaryCategory", and "subcategory" from the framework.
4.  For "details", provide a very brief summary, often including the property name if identifiable.
5.  Provide a confidence score from 0 to 1.
6.  Add a brief note explaining your reasoning (e.g., "Matched with known vendor 'Home Depot'.").
`, 
});

const categorizeTransactionsFlow = ai.defineFlow(
  {
    name: 'categorizeTransactionsFlow',
    inputSchema: CategorizeTransactionsInputSchema,
    outputSchema: CategorizeTransactionsOutputSchema,
  },
  async input => {
    const { firestore } = initializeServerFirebase();

    const userProfileSnap = await getDoc(doc(firestore, 'users', input.userId));

    const userTrade = userProfileSnap.exists()
        ? userProfileSnap.data().trade
        : 'Real Estate';
    
    const flowInput = {
        ...input,
        userTrade,
    };

    const {output} = await categorizeTransactionsPrompt(flowInput);
    return output!;
  }
);

    
