'use server';
/**
 * @fileOverview An AI agent that generalizes a transaction description.
 *
 * - generalizeTransactionDescription - A function that takes a specific transaction
 *   description and returns a generalized version suitable for creating a mapping rule.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GeneralizeTransactionInputSchema = z.object({
  transactionDescription: z
    .string()
    .describe('The specific transaction description from the bank statement.'),
});
export type GeneralizeTransactionInput = z.infer<typeof GeneralizeTransactionInputSchema>;

const GeneralizeTransactionOutputSchema = z.object({
  generalizedDescription: z
    .string()
    .describe(
      'A generalized version of the transaction description, with unique identifiers like confirmation numbers, dates, or specific amounts removed.'
    ),
});
export type GeneralizeTransactionOutput = z.infer<typeof GeneralizeTransactionOutputSchema>;

export async function generalizeTransactionDescription(
  input: GeneralizeTransactionInput
): Promise<GeneralizeTransactionOutput> {
  return generalizeDescriptionFlow(input);
}

const generalizeDescriptionPrompt = ai.definePrompt({
  name: 'generalizeDescriptionPrompt',
  input: { schema: GeneralizeTransactionInputSchema },
  output: { schema: GeneralizeTransactionOutputSchema },
  prompt: `You are an expert at identifying patterns in financial transaction descriptions. Your task is to take a specific transaction description and create a generalized version of it that can be used as a rule for future categorizations.

You MUST remove any unique, non-repeating information. This includes:
- Confirmation numbers (e.g., "Conf# 0JIZRCX70", "#lzgc09u5n")
- Specific dates or timestamps
- Invoice numbers
- Unique transaction IDs

Focus on preserving the core vendor and service information.

Here are some examples:
1. Input: "Zelle payment from Tangy Parson Conf# 0JIZRCX70"
   Output: "Zelle payment from Tangy Parson"
2. Input: "Zelle Recurring payment from for "Plano office rent"; Conf# lzgc09u5n"
   Output: "Zelle Recurring payment from for "Plano office rent";"
3. Input: "Transfer 300 LLC; "Office Lease/Rent September 2025""
   Output: "Transfer 300 LLC;"
4. Input: "UBER   TRIP   HELP.UBER.COM"
   Output: "UBER   TRIP"

Transaction Description to Generalize:
{{{transactionDescription}}}
`,
});

const generalizeDescriptionFlow = ai.defineFlow(
  {
    name: 'generalizeDescriptionFlow',
    inputSchema: GeneralizeTransactionInputSchema,
    outputSchema: GeneralizeTransactionOutputSchema,
  },
  async (input) => {
    const { output } = await generalizeDescriptionPrompt(input);
    return output!;
  }
);
