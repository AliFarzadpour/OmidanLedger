'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { db } from '@/lib/firebase-admin'; // Ensure this path matches your file structure

// Input Schema
const GenerateFinancialReportInputSchema = z.object({
  userQuery: z.string().describe('The user\'s natural language question.'),
  userId: z.string().describe('The ID of the user to fetch data for.'),
});

type GenerateFinancialReportInput = z.infer<typeof GenerateFinancialReportInputSchema>;

// Helper: Fetch transactions using ADMIN SDK syntax (db.collection)
async function fetchAndFormatTransactions(userId: string): Promise<string> {
  try {
    console.log(`[AI-FLOW] Fetching transactions for user: ${userId}`);
    
    // CORRECT SYNTAX: Method chaining (db.collection().doc()...)
    // Do NOT use "collection(db, ...)" functions here.
    const snapshot = await db
      .collectionGroup('transactions')
      .where('userId', '==', userId)
      .orderBy('date', 'desc')
      .limit(500) 
      .get();

    if (snapshot.empty) {
      console.log("[AI-FLOW] No transactions found.");
      return "";
    }
    
    const transactions = snapshot.docs.map(doc => doc.data());

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

  } catch (error: any) {
    console.error("[AI-FLOW] Database Error:", error);
    // Throwing a simple error string helps the UI show a clean message
    throw new Error(`Database Error: ${error.message}`);
  }
}

// Define the Prompt
const reportingPrompt = ai.definePrompt({
  name: 'financialReportPrompt',
  input: {
    schema: z.object({
      userQuery: z.string(),
      transactionData: z.string(),
      currentDate: z.string(),
    }),
  },
  prompt: `You are an expert financial analyst.
  
Today: {{{currentDate}}}

User Question: "{{{userQuery}}}"

Data (CSV):
---
{{{transactionData}}}
---

Answer concise and use Markdown. If data is empty, say so.`,
});

// Main Flow
export const generateFinancialReportFlow = ai.defineFlow(
  {
    name: 'generateFinancialReportFlow',
    inputSchema: GenerateFinancialReportInputSchema,
    outputSchema: z.string(),
  },
  async ({ userQuery, userId }) => {
    // 1. Fetch Data
    const transactionData = await fetchAndFormatTransactions(userId);

    if (!transactionData) {
      return "I couldn't find any transactions for this account.";
    }

    // 2. Generate Report
    const { text } = await ai.generate({
        prompt: `You are an expert financial analyst AI. Your task is to answer a user's question based on the provided transaction data.
The data is in CSV format: "date,description,amount,category_path".

Today's Date: ${new Date().toISOString().split('T')[0]}

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
    `.trim(),
    });


    if (!text) {
        throw new Error("The AI returned an empty response.");
    }
    
    return text;
  }
);

// Server Action Entry Point
export async function generateFinancialReport(input: GenerateFinancialReportInput) {
  try {
    return await generateFinancialReportFlow(input);
  } catch (error: any) {
    console.error("Critical Failure:", error);
    throw new Error(error.message);
  }
}
