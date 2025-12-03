'use server';

/**
 * @fileOverview An AI flow to generate financial reports based on user queries.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const GenerateFinancialReportInputSchema = z.object({
  userQuery: z.string().describe('The user\'s natural language question or report request.'),
  transactionData: z.string().describe('A string containing the user\'s transaction data in CSV format.'),
});
export type GenerateFinancialReportInput = z.infer<typeof GenerateFinancialReportInputSchema>;

export async function generateFinancialReport(input: GenerateFinancialReportInput): Promise<string> {
  return generateFinancialReportFlow(input);
}

const generateFinancialReportFlow = ai.defineFlow(
  {
    name: 'generateFinancialReportFlow',
    inputSchema: GenerateFinancialReportInputSchema,
    outputSchema: z.string(),
  },
  async ({ userQuery, transactionData }) => {
    
    // Define the LLM prompt. It now receives the transaction data directly.
    const reportingPrompt = ai.definePrompt({
        name: 'financialReportPrompt',
        input: {
            schema: z.object({
                userQuery: z.string(),
                transactionData: z.string(),
            }),
        },
        prompt: `You are an expert financial analyst AI. Your task is to answer a user's question based on the provided transaction data.
The data is in CSV format: 'date, description, amount, category_path'.

Today's Date: ${new Date().toISOString().split('T')[0]}

User's Question:
"{{{userQuery}}}"

Transaction Data:
---
{{{transactionData}}}
---

Based on the data, provide a clear, concise answer to the user's question.
- Perform calculations if necessary (e.g., summing totals, finding averages).
- Format your answer in clear, readable Markdown. Use tables, lists, and bold text to improve readability.
- If the data is insufficient to answer the question, state that clearly and explain what information is missing.
- Do not invent data. Your entire analysis must be based *only* on the transaction data provided.`,
    });

    const { output } = await reportingPrompt({
        userQuery,
        transactionData,
    });
    
    return output || "I was unable to generate a report based on your request. Please try rephrasing your question.";
  }
);
