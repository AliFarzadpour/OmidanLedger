'use server';

/**
 * @fileOverview An AI flow to generate financial reports based on user queries.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { initializeServerFirebase } from '@/ai/utils';
import { collectionGroup, getDocs, query, where } from 'firebase/firestore';

const GenerateFinancialReportInputSchema = z.object({
  userId: z.string().describe('The ID of the user requesting the report.'),
  query: z.string().describe('The user\'s natural language question or report request.'),
});
export type GenerateFinancialReportInput = z.infer<typeof GenerateFinancialReportInputSchema>;

export async function generateFinancialReport(input: GenerateFinancialReportInput): Promise<string> {
  return generateFinancialReportFlow(input);
}

// Internal type for transactions fetched from Firestore
interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  primaryCategory: string;
  secondaryCategory: string;
  subcategory: string;
}

const generateFinancialReportFlow = ai.defineFlow(
  {
    name: 'generateFinancialReportFlow',
    inputSchema: GenerateFinancialReportInputSchema,
    outputSchema: z.string(),
  },
  async ({ userId, query: userQuery }) => {
    // 1. Fetch user's transaction data from Firestore
    const { firestore } = initializeServerFirebase();
    const transactionsQuery = query(
      collectionGroup(firestore, 'transactions'),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(transactionsQuery);
    const transactions: Transaction[] = snapshot.docs.map(doc => doc.data() as Transaction);

    // 2. Format the data into a simple string for the LLM
    const transactionDataString = transactions
        .map(t => `${t.date}, ${t.description}, ${t.amount.toFixed(2)}, ${t.primaryCategory} > ${t.secondaryCategory} > ${t.subcategory}`)
        .join('\n');
    
    // 3. Define and call the LLM prompt
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
        transactionData: transactionDataString,
    });
    
    return output || "I was unable to generate a report based on your request. Please try rephrasing your question.";
  }
);
