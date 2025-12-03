'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { db } from '@/lib/firebase-admin';
import { collectionGroup, getDocs, query, where, orderBy, limit } from 'firebase/firestore';

// Represents a transaction document in Firestore
interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  primaryCategory: string;
  secondaryCategory: string;
  subcategory: string;
  userId: string;
}

// 1. Input Schema Change: Now only accepts userId and the user's query.
const GenerateFinancialReportInputSchema = z.object({
  userQuery: z.string().describe("The user's natural language question or report request."),
  userId: z.string().describe("The user's unique ID to fetch data for."),
});
export type GenerateFinancialReportInput = z.infer<typeof GenerateFinancialReportInputSchema>;

/**
 * 2. Database Fetch & 3. Data Optimization
 * Fetches transaction history for a user and formats it into a CSV string.
 */
async function fetchAndFormatTransactions(userId: string): Promise<string> {
  try {
    // Note: We use the Client SDK syntax here, but because we initialize with admin
    // credentials on the server, it has the necessary permissions.
    // This maintains syntax consistency with client-side queries.
    const transactionsQuery = query(
      collectionGroup(db, 'transactions'),
      where('userId', '==', userId),
      orderBy('date', 'desc'), // Order by date
      limit(500) // Limit to the last 500 transactions to manage token count
    );

    const snapshot = await getDocs(transactionsQuery);

    if (snapshot.empty) {
      console.log(`[AI-FLOW] No transactions found for user ${userId}.`);
      return ''; // Return empty string if no transactions are found
    }

    const transactions = snapshot.docs.map(doc => doc.data() as Transaction);

    console.log(`[AI-FLOW] Fetched ${transactions.length} transactions for user ${userId}.`);

    // Convert to CSV string
    const csvString = transactions
      .map((t) => {
        const amt = typeof t.amount === 'number' ? t.amount : Number(t.amount ?? 0);
        // Sanitize description for CSV: remove commas and newlines
        const safeDescription = (t.description ?? '').replace(/,/g, ' ').replace(/\n/g, ' ');
        return `${t.date},${safeDescription},${amt.toFixed(2)},${t.primaryCategory} > ${t.secondaryCategory} > ${t.subcategory}`;
      })
      .join('\n');
      
    return csvString;

  } catch (error) {
    console.error("[AI-FLOW] Error fetching transaction history:", error);
    // Propagate a more specific error.
    throw new Error("Could not fetch transaction history from the database. Please check server logs and Firestore permissions.");
  }
}


// The main Server Action that can be called from the client.
export async function generateFinancialReport(input: GenerateFinancialReportInput): Promise<string> {
  console.log('[AI-FLOW] Starting generateFinancialReport...');
  try {
    const result = await generateFinancialReportFlow(input);
    console.log('[AI-FLOW] generateFinancialReport successful.');
    return result;
  } catch (error: any) {
    console.error('[AI-FLOW] A critical error occurred in the generateFinancialReport flow:', error);
    // Rethrow the error so the client's catch block can handle it.
    throw new Error(`Failed to generate report: ${error.message}`);
  }
}

/**
 * 4. Flow Logic: The Genkit flow that orchestrates the RAG process.
 */
const generateFinancialReportFlow = ai.defineFlow(
  {
    name: 'generateFinancialReportFlow',
    inputSchema: GenerateFinancialReportInputSchema,
    outputSchema: z.string(),
  },
  async ({ userQuery, userId }) => {
    console.log(`[AI-FLOW] generateFinancialReportFlow invoked for user: ${userId}`);

    // API Key Check
    if (!process.env.GEMINI_API_KEY) {
        console.error('[AI-FLOW] Server API Key is missing.');
        throw new Error('Server API Key is not configured. Please set the GEMINI_API_KEY environment variable.');
    }

    // Step 1: Fetch and format the data from Firestore.
    const transactionData = await fetchAndFormatTransactions(userId);

    // Step 2: Check if there is data to analyze.
    if (!transactionData) {
      return "I couldn't find any transaction data to analyze. Please add some transactions and try again.";
    }
    console.log(`[AI-FLOW] Transaction data length: ${transactionData.length} characters.`);


    const currentDate = new Date().toISOString().split('T')[0];

    // Step 3: Construct the prompt with the retrieved data.
    const prompt = `
You are an expert financial analyst AI. Your task is to answer a user's question based on the provided transaction data.
The data is in CSV format: "date,description,amount,category_path".

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

    // Step 4: Call the AI model.
    try {
      console.log('[AI-FLOW] Calling AI.generate()...');
      const { text } = await ai.generate({
        prompt,
      });

      if (!text) {
        console.warn('[AI-FLOW] AI response text is null or undefined.');
        throw new Error('The AI returned an empty response.');
      }

      console.log('[AI-FLOW] AI generation successful.');
      return text;
    } catch (e: any) {
      console.error("[AI-FLOW] AI Generation Error:", e);
      // 5. Error Handling - Propagate a clear message.
      throw new Error(`There was a problem communicating with the AI. Details: ${e.message}`);
    }
  }
);
