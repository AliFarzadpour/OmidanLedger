
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { db as adminDb } from '@/lib/admin-db'; // Use the robust admin instance
import type { Query, FieldFilter, OrderByDirection } from 'firebase-admin/firestore';

// --- TOOLS ---

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

const fetchPropertiesTool = ai.defineTool(
  {
    name: 'fetchProperties',
    description: 'Fetches property data from the database based on specified filters and sorting.',
    inputSchema: propertyQueryToolSchema,
    outputSchema: z.array(z.any()), 
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

// NEW: Define a schema for chart data
const ChartDataSchema = z.array(z.object({
    name: z.string().describe("The label for the data point (e.g., a city name, property type)."),
    value: z.number().describe("The numerical value for the data point (e.g., count of properties).")
})).optional();


// NEW: Define the flow's output schema
const PropertyReportOutputSchema = z.object({
    reportText: z.string().describe("The natural language text report in Markdown format."),
    chartData: ChartDataSchema.describe("Optional data formatted for a bar chart visualization.")
});


export const generatePropertyReportFlow = ai.defineFlow(
  {
    name: 'generatePropertyReportFlow',
    inputSchema: GeneratePropertyReportInputSchema,
    outputSchema: PropertyReportOutputSchema, // Use the new output schema
  },
  async ({ userQuery, userId }) => {
    
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userName = userDoc.exists ? userDoc.data()?.name || userDoc.data()?.email : `user ${userId}`;

    const llmResponse = await ai.generate({
      prompt: `
        You are an expert real estate portfolio analyst for a user named ${userName}. Your task is to answer questions about their properties by querying a database and generating reports, including data for charts.

        **Core Instructions:**

        1.  **Analyze the Query & Chart Potential**: First, understand the user's request: "${userQuery}".
            - If the query asks for a breakdown, count, or summary (e.g., "by type", "by city"), you MUST generate data for a chart. Format this data as an array of objects: \`[{name: "Label", value: 123}, ...]\`.
            - If the query asks for a list or table, generate a text-based report in Markdown. You can skip the chart data in this case.

        2.  **Construct and Use Tools**: Use the \`fetchProperties\` tool to get the data. Combine the mandatory user filter with any other filters you identified.
            - **Mandatory User Filter**: You MUST ALWAYS include a filter for the user's ID in your query. Construct a \`where\` condition like this: \`{field: 'userId', operator: '==', value: '${userId}'}\`.
            - \`fetchCategorizationRules\` can be used to get vendor/rule data if needed.

        3.  **Natural Language Mapping & Occupancy Logic:**
            - A property is "occupied" if it has at least one tenant with \`status: 'active'\`. A property is "vacant" if it has no tenants or only tenants with \`status: 'past'\`.

        4.  **Crucial Fallback Logic:** If the user's query contains multiple filters (e.g., \`type: 'single-family'\` AND \`location: 'Dallas'\`) and the \`fetchProperties\` tool returns an empty result, you **MUST** try a second time. In this second attempt, remove one of the filters (e.g., just search for \`location: 'Dallas'\`) and call the tool again. If this second attempt finds properties, you must present those results to the user.

        5.  **Format Output**: Based on the data returned by the tool, generate a clear text report in \`reportText\`. If you generated chart data, include it in the \`chartData\` field.
      `,
      tools: [fetchPropertiesTool, fetchCategorizationRulesTool],
      model: 'googleai/gemini-2.5-flash',
      output: { schema: PropertyReportOutputSchema },
    });

    const output = llmResponse.output;

    if (!output) {
        throw new Error("The AI returned an empty response.");
    }
    
    // Developer Note feedback logic
    if (output.reportText.includes("couldn't find any")) {
        output.reportText += "\n\n**Developer Note:** Your query failed. As per instructions, you MUST now attempt a second, broader query by removing one of the filters (e.g., property type) to see if other relevant properties exist in that location.";
    }
    
    return output;
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
