'use server';
/**
 * @fileOverview An AI agent that analyzes a single transaction to extract key information like entity, role, and purpose.
 *
 * - analyzeTransactionEntity - A function that handles the analysis process.
 * - AnalyzeTransactionEntityInput - The input type for the function.
 * - AnalyzeTransactionEntityOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// --- INPUT SCHEMA ---
export const AnalyzeTransactionEntityInputSchema = z.object({
  transactionDescription: z.string().describe('The full transaction line item from a bank statement.'),
  amount: z.number().describe('The transaction amount. Positive for income, negative for expenses.'),
});
export type AnalyzeTransactionEntityInput = z.infer<typeof AnalyzeTransactionEntityInputSchema>;


// --- OUTPUT SCHEMA ---
export const AnalyzeTransactionEntityOutputSchema = z.object({
  entity: z.string().describe('The name of the person or company paying or being paid.'),
  role: z.enum(['Tenant/Payer', 'Vendor/Payee']).describe('The role of the entity based on the transaction amount.'),
  purpose: z.string().describe('The inferred purpose of the transaction (e.g., "Rent", "Pool Cleaning", "Utility").'),
});
export type AnalyzeTransactionEntityOutput = z.infer<typeof AnalyzeTransactionEntityOutputSchema>;


// --- WRAPPER FUNCTION ---
export async function analyzeTransactionEntity(input: AnalyzeTransactionEntityInput): Promise<AnalyzeTransactionEntityOutput> {
  return analyzeTransactionEntityFlow(input);
}


// --- GENKIT PROMPT ---
const analyzeTransactionPrompt = ai.definePrompt({
  name: 'analyzeTransactionPrompt',
  input: { schema: AnalyzeTransactionEntityInputSchema },
  output: { schema: AnalyzeTransactionEntityOutputSchema },
  prompt: `
You are an accounting AI. Analyze the following transaction description and amount.

Transaction: "{{{transactionDescription}}}"
Amount: {{{amount}}}

1. Identify the Entity Name (Who is paying or being paid?).
2. Determine the Role:
   - If Amount > 0: Role is "Tenant/Payer"
   - If Amount < 0: Role is "Vendor/Payee"
3. Extract the purpose (e.g., "Rent", "Pool Cleaning", "Utility").

Return JSON: { "entity": string, "role": string, "purpose": string }
`,
});


// --- GENKIT FLOW ---
const analyzeTransactionEntityFlow = ai.defineFlow(
  {
    name: 'analyzeTransactionEntityFlow',
    inputSchema: AnalyzeTransactionEntityInputSchema,
    outputSchema: AnalyzeTransactionEntityOutputSchema,
  },
  async (input) => {
    const { output } = await analyzeTransactionPrompt(input);
    
    if (!output) {
        throw new Error("The AI failed to return a valid analysis.");
    }
    
    return output;
  }
);
