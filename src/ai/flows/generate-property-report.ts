
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { db as adminDb } from '@/lib/admin-db';
import type { Query, FieldFilter, OrderByDirection } from 'firebase-admin/firestore';

// --- TOOLS ---

// Defines the structure for the AI-generated query for properties.
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
    let q: Query = adminDb.collection('properties');

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
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
);

// NEW TOOL: Fetches categorization rules for a user.
const fetchCategorizationRulesTool = ai.defineTool(
  {
    name: 'fetchCategorizationRules',
    description: 'Fetches all personal categorization (Smart Rules) for a user.',
    inputSchema: z.object({
      userId: z.string().describe("The ID of the user whose rules to fetch."),
    }),
    outputSchema: z.array(z.any()),
  },
  async ({ userId }) => {
    const rulesSnap = await adminDb.collection('users').doc(userId).collection('categoryMappings').get();
    if (rulesSnap.empty) return [];
    return rulesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
);


// --- MAIN FLOW ---

const GeneratePropertyReportInputSchema = z.object({
  userQuery: z.string().describe("The user's natural language question about their properties."),
  userId: z.string().describe("The ID of the user to fetch data for."),
});

export const generatePropertyReportFlow = ai.defineFlow(
  {
    name: 'generatePropertyReportFlow',
    inputSchema: GeneratePropertyReportInputSchema,
    outputSchema: z.string(), // The final output is a markdown string.
  },
  async ({ userQuery, userId }) => {
    
    // Fetch the user's profile to get their name
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userName = userDoc.exists ? userDoc.data()?.name || userDoc.data()?.email : `user ${userId}`;


    const llmResponse = await ai.generate({
      prompt: `
        You are an expert real estate portfolio analyst for a user named ${userName}. Your task is to answer questions about their properties.

        **Core Instructions:**
        1.  **Analyze the Query:** Understand the user's request: "${userQuery}".
        2.  **Use Tools:** You MUST use the available tools to get the necessary data.
            - \`fetchProperties\` for property data (location, type, rent).
            - \`fetchCategorizationRules\` for vendor/rule data.
        3.  **Mandatory User Filter:** When using \`fetchProperties\`, ALWAYS include a \`where\` clause to filter by the current user: \`{field: 'userId', operator: '==', value: '${userId}'}\`.
        4.  **Natural Language Mapping & Occupancy Logic:**
            - Map terms like "vacant", "in texas", "multi-family" to the correct data fields (e.g., 'status', 'address.state', 'type').
            - A property is "occupied" if it has at least one tenant with \`status: 'active'\`. A property is "vacant" if it has no tenants or only tenants with \`status: 'past'\`.
        5.  **Helpful Alternative Answers:** If a query for a specific filter (e.g., 'single-family' homes in Dallas) returns no results, you MUST run a second, broader query (e.g., *any* property in 'Dallas'). If that second query finds results, you MUST inform the user you couldn't find their specific request but then offer the alternative results. For example: "I couldn't find any single-family homes in Dallas, but I did find these other properties for you there:".
        6.  **Format Output:** Present your final answer in clear, readable Markdown. Use tables for lists.
      `,
      tools: [fetchPropertiesTool, fetchCategorizationRulesTool], // Provide BOTH tools to the AI.
      model: 'googleai/gemini-2.5-flash',
    });

    const reportText = llmResponse.text;

    if (!reportText) {
        throw new Error("The AI returned an empty response. It might be having trouble with the request.");
    }
    
    return reportText;
  }
);

// --- SERVER ACTION WRAPPER ---
export async function generatePropertyReport(input: z.infer<typeof GeneratePropertyReportInputSchema>) {
  try {
    return await generatePropertyReportFlow(input);
  } catch (error: any) {
    console.error("Critical Failure in generatePropertyReport flow:", error);
    throw new Error(error.message || 'An unexpected error occurred while generating the report.');
  }
}
