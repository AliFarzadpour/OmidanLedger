'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { db as adminDb } from '@/lib/admin-db';
import type { Query, FieldFilter, OrderByDirection } from 'firebase-admin/firestore';

// --- TOOLS ---

// Defines the structure for the AI-generated query.
const propertyQueryToolSchema = z.object({
  where: z
    .array(
      z.object({
        field: z.string().describe("The field path to filter on (e.g., 'address.state', 'type')."),
        operator: z.enum(['==', '!=', '>', '<', '>=', '<=', 'in', 'not-in', 'array-contains', 'array-contains-any']).describe("The comparison operator."),
        value: z.any().describe("The value to compare against.")
      })
    )
    .optional()
    .describe("An array of 'where' conditions to filter properties."),
  orderBy: z.string().optional().describe("The field to sort the results by."),
  orderDirection: z.enum(['asc', 'desc']).optional().describe("The direction to sort in."),
  limit: z.number().optional().describe("The maximum number of properties to return.")
});


// Tool for the AI to fetch property data from Firestore.
const fetchPropertiesTool = ai.defineTool(
  {
    name: 'fetchProperties',
    description: 'Fetches property data from the database based on specified filters and sorting.',
    inputSchema: propertyQueryToolSchema,
    outputSchema: z.array(z.any()), // We expect an array of property objects.
  },
  async (params) => {
    // This is a privileged server-side function, so we use the admin SDK.
    let q: Query = adminDb.collection('properties');

    // Dynamically build the query from the AI's generated parameters.
    if (params.where) {
      for (const { field, operator, value } of params.where) {
        q = q.where(field, operator as FieldFilter['op'], value);
      }
    }
    if (params.orderBy) {
      q = q.orderBy(params.orderBy, params.orderDirection as OrderByDirection | undefined);
    }
    if (params.limit) {
      q = q.limit(params.limit);
    }

    const snapshot = await q.get();
    if (snapshot.empty) return [];

    // Return the data in a clean array format for the AI to analyze.
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
);


// --- MAIN FLOW ---

const GeneratePropertyReportInputSchema = z.object({
  userQuery: z.string().describe("The user's natural language question about their properties."),
  userId: z.string().describe("The ID of the user to fetch data for."),
});

// This is the main flow that orchestrates the AI's work.
export const generatePropertyReportFlow = ai.defineFlow(
  {
    name: 'generatePropertyReportFlow',
    inputSchema: GeneratePropertyReportInputSchema,
    outputSchema: z.string(), // The final output is a markdown string.
  },
  async ({ userQuery, userId }) => {
    
    const llmResponse = await ai.generate({
      prompt: `
        You are an expert real estate portfolio analyst. Your task is to answer a user's question about their properties.
        
        1.  First, analyze the user's query: "${userQuery}".
        2.  You MUST use the 'fetchProperties' tool to get the necessary data. Generate the correct 'where', 'orderBy', and 'limit' parameters for the tool.
            - ALWAYS add a 'where' clause to filter by the current user: \`{field: 'userId', operator: '==', value: '${userId}'}\`
            - Map natural language queries (e.g., "vacant", "in texas", "multi-family") to the correct data fields (e.g., 'status', 'address.state', 'type').
        3.  After receiving the data from the tool, analyze it to formulate a clear, concise answer.
        4.  Format your final answer in readable Markdown. Use tables for lists of properties.
      `,
      tools: [fetchPropertiesTool], // Provide the tool to the AI.
      model: 'googleai/gemini-2.5-flash',
    });

    // The AI's final message after using the tool is the report we want.
    const reportText = llmResponse.text;

    if (!reportText) {
        throw new Error("The AI returned an empty response. It might be having trouble with the request.");
    }
    
    return reportText;
  }
);

// --- SERVER ACTION WRAPPER ---
// This is the function the frontend will call.
export async function generatePropertyReport(input: z.infer<typeof GeneratePropertyReportInputSchema>) {
  try {
    return await generatePropertyReportFlow(input);
  } catch (error: any) {
    console.error("Critical Failure in generatePropertyReport flow:", error);
    throw new Error(error.message || 'An unexpected error occurred while generating the report.');
  }
}
