'use server';

/**
 * @fileOverview An AI flow to generate financial reports based on user queries.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { initializeServerFirebase } from '@/ai/utils';
import { collectionGroup, getDocs, query, where } from 'firebase/firestore';

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  primaryCategory: string;
  secondaryCategory: string;
  subcategory: string;
}

const GenerateFinancialReportInputSchema = z.object({
  userQuery: z.string().describe("The user's natural language question or report request."),
  userId: z.string().describe("The user's unique ID."),
});
export type GenerateFinancialReportInput = z.infer<typeof GenerateFinancialReportInputSchema>;

// Define the schema for the prompt's input.
const FinancialReportPromptSchema = z.object({
    userQuery: z.string(),
    transactionData: z.string(),
});

// Define the prompt at the module level.
const reportingPrompt = ai.definePrompt({
    name: 'financialReportPrompt',
    input: {
        schema: FinancialReportPromptSchema,
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


export async function generateFinancialReport(input: GenerateFinancialReportInput): Promise<string> {
  return generateFinancialReportFlow(input);
}

const generateFinancialReportFlow = ai.defineFlow(
  {
    name: 'generateFinancialReportFlow',
    inputSchema: GenerateFinancialReportInputSchema,
    outputSchema: z.string(),
  },
  async ({ userQuery, userId }) => {
    
    // 1. Fetch data on the server
    const { firestore } = initializeServerFirebase();
    const transactionsQuery = query(
      collectionGroup(firestore, 'transactions'),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(transactionsQuery);
    const transactions = snapshot.docs.map(doc => doc.data() as Transaction);

    if (transactions.length === 0) {
      return "I couldn't find any transaction data to analyze. Please add some transactions and try again.";
    }

    // 2. Format data for the AI
    const transactionData = transactions
      .map(t => `${t.date},${t.description},${t.amount.toFixed(2)},${t.primaryCategory} > ${t.secondaryCategory} > ${t.subcategory}`)
      .join('\n');
    
    // 3. Call the prompt with the received input, ensuring it matches the prompt's schema.
    const { output } = await reportingPrompt({
        userQuery,
        transactionData: transactionData,
    });
    
    return output || "I was unable to generate a report based on your request. Please try rephrasing your question.";
  }
);
