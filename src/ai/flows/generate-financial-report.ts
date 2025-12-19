
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getFirestore } from 'firebase-admin/firestore';
import { getApps, initializeApp } from 'firebase-admin/app';
import { Query, Timestamp } from 'firebase-admin/firestore';

// Helper to ensure Admin SDK is initialized once
function getAdminDB() {
  if (!getApps().length) {
    initializeApp();
  }
  return getFirestore();
}

// Input Schema
const GenerateFinancialReportInputSchema = z.object({
  userQuery: z.string().describe('The user\'s natural language question.'),
  userId: z.string().describe('The ID of the user to fetch data for.'),
});

type GenerateFinancialReportInput = z.infer<typeof GenerateFinancialReportInputSchema>;


type Transaction = {
    id: string;
    date: string;
    description: string;
    amount: number;
    primaryCategory: string;
    secondaryCategory?: string;
    subcategory?: string;
    userId: string;
};
  
async function fetchTransactions(userId: string): Promise<Transaction[]> {
    console.log(`[AI-FLOW] Fetching transactions for user: ${userId}`);
    const db = getAdminDB(); // Initialize DB inside the function
    const snapshot = await db
        .collectionGroup('transactions')
        .where('userId', '==', userId)
        .orderBy('date', 'desc')
        .limit(5000) // Fetch up to 5000 recent transactions
        .get();

    if (snapshot.empty) {
        console.log("[AI-FLOW] No transactions found.");
        return [];
    }

    const transactions = snapshot.docs.map(doc => {
        const data = doc.data();
        // Ensure date is a string in YYYY-MM-DD format
        let dateStr = data.date;
        if (data.date instanceof Timestamp) {
            dateStr = data.date.toDate().toISOString().split('T')[0];
        }
        return {
            id: doc.id,
            ...data,
            date: dateStr,
        } as Transaction;
    });

    console.log(`[AI-FLOW] Fetched and processed ${transactions.length} transactions.`);
    return transactions;
}

// Main Flow
export const generateFinancialReportFlow = ai.defineFlow(
  {
    name: 'generateFinancialReportFlow',
    inputSchema: GenerateFinancialReportInputSchema,
    outputSchema: z.string(),
  },
  async ({ userQuery, userId }) => {
    // 1. Fetch Data (Calculator step)
    const transactions = await fetchTransactions(userId);

    if (transactions.length === 0) {
      return "I couldn't find any transactions for this account. Please add some transactions to generate a report.";
    }

    // 2. Generate Report (Analyst step)
    const { text } = await ai.generate({
        prompt: `You are an expert financial analyst AI. Your task is to answer a user's question based on the provided transaction data.
The user's transaction history is provided as a JSON array. Each transaction has a date, description, amount, and a three-level category path.

Today's Date: ${new Date().toISOString().split('T')[0]}

User's Question:
"${userQuery}"

Transaction Data (JSON):
---
${JSON.stringify(transactions, null, 2)}
---

Based on the data, provide a clear, concise, and insightful answer to the user's question.
- Perform calculations if necessary (e.g., summing totals, finding averages, identifying trends).
- If the question involves a specific time period (e.g., "last month," "this quarter"), filter the data accordingly before performing calculations.
- Format your answer in clear, readable Markdown. Use tables, lists, and **bold** text to improve readability.
- If the data is insufficient to answer the question fully, state that clearly and explain what information is missing.
- Do not invent data. Your entire analysis must be based *only* on the transaction data provided.
- Your final response should be just the Markdown report. Do not include introductory phrases like "Here is the report".
    `.trim(),
    });


    if (!text) {
        throw new Error("The AI returned an empty response. It might be having trouble with the request.");
    }
    
    return text;
  }
);

// Server Action Entry Point
export async function generateFinancialReport(input: GenerateFinancialReportInput) {
  try {
    return await generateFinancialReportFlow(input);
  } catch (error: any) {
    console.error("Critical Failure in generateFinancialReport flow:", error);
    // Provide a more user-friendly error message to the client.
    throw new Error(error.message || 'An unexpected error occurred while generating the report.');
  }
}
