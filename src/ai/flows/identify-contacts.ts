'use server';
/**
 * @fileOverview An AI agent that analyzes a raw list of transactions to identify
 *               potential tenants (income sources) and vendors (expense destinations).
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// --- INPUT SCHEMA ---
const IdentifyContactsInputSchema = z.object({
  rawTransactionsList: z
    .string()
    .describe('A string containing a list of raw transaction descriptions, typically one per line.'),
});
export type IdentifyContactsInput = z.infer<typeof IdentifyContactsInputSchema>;


// --- OUTPUT SCHEMA ---
const TenantSchema = z.object({
  name: z.string().describe("The name of the tenant found in the transaction description."),
  average_rent: z.number().describe("The typical or average rent amount paid by this tenant."),
  payment_method: z.string().describe("The method of payment, e.g., Zelle, Check, ACH."),
});

const VendorSchema = z.object({
  name: z.string().describe("The name of the vendor or service provider."),
  service_type: z.string().describe("The type of service provided, e.g., Pool, Roof, Tax, Insurance."),
  typical_amount: z.number().describe("The typical or average amount paid to this vendor."),
});

const IdentifyContactsOutputSchema = z.object({
  tenants: z.array(TenantSchema),
  vendors: z.array(VendorSchema),
});
export type IdentifyContactsOutput = z.infer<typeof IdentifyContactsOutputSchema>;


// --- WRAPPER FUNCTION ---
export async function identifyContacts(input: IdentifyContactsInput): Promise<IdentifyContactsOutput> {
  return identifyContactsFlow(input);
}


// --- GENKIT PROMPT ---
const identifyContactsPrompt = ai.definePrompt({
  name: 'identifyContactsPrompt',
  input: { schema: IdentifyContactsInputSchema },
  output: { schema: IdentifyContactsOutputSchema },
  prompt: `
Analyze this list of real estate transactions. 
Identify the "Wage/Income" sources (Tenants) and the "Expense" destinations (Vendors).

Transactions:
{{{rawTransactionsList}}}

Return a JSON object:
{
  "tenants": [
    { "name": "Name found in description", "average_rent": 1234.00, "payment_method": "Zelle/Check" }
  ],
  "vendors": [
     { "name": "Name found in description", "service_type": "Pool/Roof/Tax", "typical_amount": 123.00 }
  ]
}
`,
});


// --- GENKIT FLOW ---
const identifyContactsFlow = ai.defineFlow(
  {
    name: 'identifyContactsFlow',
    inputSchema: IdentifyContactsInputSchema,
    outputSchema: IdentifyContactsOutputSchema,
  },
  async (input) => {
    const { output } = await identifyContactsPrompt(input);
    
    if (!output) {
        throw new Error("The AI failed to return a valid response.");
    }
    
    return output;
  }
);
