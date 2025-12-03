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

    // Optionally limit to recent N transactions to avoid token limits
    const MAX_ROWS = 500;
    const limitedTransactions = transactions.slice(-MAX_ROWS);

    // 2. Format data for the AI as CSV
    const transactionData = limitedTransactions
      .map((t) => {
        // Be defensive about amount in case Firestore stored it as a string.
        const amt = typeof t.amount === 'number' ? t.amount : Number(t.amount ?? 0);
        const safeDescription = (t.description ?? '').replace(/\n/g, ' ');
        return `${t.date},${safeDescription},${amt.toFixed(2)},${t.primaryCategory} > ${t.secondaryCategory} > ${t.subcategory}`;
      })
      .join('\n');
    
    const currentDate = new Date().toISOString().split('T')[0];

    const prompt = `
You are an expert financial analyst AI. Your task is to answer a user's question based on the provided transaction data.
The data is in CSV format: "date, description, amount, category_path".

Today's Date: ${currentDate}

User's Question:
"${userQuery}"

Transaction Data:
---
${transactionData}
---

Based on the data, provide a clear, concise answer to the user's question.
- Perform calculations if necessary (e.g., summing totals, finding averages).
- Format your answer in clear, readable Markdown. Use tables, lists, and **bold** text to improve readability.
- If the data is insufficient to answer the question, state that clearly and explain what information is missing.
- Do not invent data. Your entire analysis must be based *only* on the transaction data provided.
    `.trim();

    try {
        const { text } = await ai.generate({
            prompt,
        });
        return text;
    } catch (e: any) {
        console.error("AI Generation Error:", e);
        return "There was a problem communicating with the AI. Please check the server logs for more details.";
    }
  }
);
