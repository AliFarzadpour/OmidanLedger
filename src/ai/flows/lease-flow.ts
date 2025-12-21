'use server';
/**
 * @fileOverview An agentic workflow for generating state-compliant lease agreements.
 * This file has been modified to remove client-side PDF generation libraries (jspdf)
 * which were causing build errors in the server-side environment.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { 
  LeaseAgentInputSchema, 
  LeaseAgentOutputSchema,
  type LeaseAgentInput,
  type LeaseAgentOutput
} from './schemas/lease-flow.schema';


// --- TOOLS (Future Implementation) ---

// Tool to fetch property & tenant data from Firestore
const getPropertyDataTool = ai.defineTool(
  {
    name: 'getPropertyData',
    description: 'Fetches property and tenant details from the database.',
    inputSchema: z.object({ propertyId: z.string(), tenantId: z.string() }),
    outputSchema: z.any(), // In a real scenario, this would be a strict Zod schema
  },
  async ({ propertyId, tenantId }) => {
    // In a real implementation, this would use the Admin SDK to fetch data
    console.log(`Tool: Fetching data for Property ${propertyId} and Tenant ${tenantId}`);
    return {
      propertyName: '123 Main St',
      rent: 2000,
      tenantName: 'John Doe',
    };
  }
);

// Tool to fetch state-specific legal clauses
const getLegalClausesTool = ai.defineTool(
  {
    name: 'getLegalClauses',
    description: 'Fetches state-specific legal clauses from the legal dictionary.',
    inputSchema: z.object({ state: z.string() }),
    outputSchema: z.any(), // Again, this would be a strict schema
  },
  async ({ state }) => {
    // This would fetch from 'docs/legal/lease-dictionary.json' or a Firestore collection
    console.log(`Tool: Fetching legal clauses for ${state}`);
    return {
      securityDepositClause: `In ${state}, security deposits must be returned within 30 days.`,
    };
  }
);


// --- MAIN FLOW (Internal, not exported) ---

const leaseAgentFlow = ai.defineFlow(
  {
    name: 'leaseAgentFlow',
    inputSchema: LeaseAgentInputSchema,
    outputSchema: LeaseAgentOutputSchema,
  },
  async (input) => {
    
    // 1. Fetch Data using Tools
    const propertyData = await ai.runFlow(getPropertyDataTool, {
      propertyId: input.propertyId,
      tenantId: input.tenantId,
    });
    
    const legalClauses = await ai.runFlow(getLegalClausesTool, {
      state: input.state,
    });

    // 2. "Stitch" the Lease with Gemini
    const { text: leaseText } = await ai.generate({
      prompt: `
        You are a paralegal AI. Your task is to assemble a lease agreement.
        Use the provided property data and legal clauses.

        Property Data:
        ${JSON.stringify(propertyData, null, 2)}

        State-Specific Clauses:
        ${JSON.stringify(legalClauses, null, 2)}

        Generate a simple, clear lease agreement based on this information.
      `,
    });

    console.log('Generated Lease Text:', leaseText);
    
    // 3. Convert Text to PDF and return as Data URI
    // Reverted: PDF generation was causing build errors. Returning placeholder.
    const pdfDataUri = "data:application/pdf;base64,";


    return {
      leaseDocumentUrl: pdfDataUri,
      summary: `Lease generated for ${propertyData.tenantName} at ${propertyData.propertyName}.`,
      complianceStatus: 'review_needed', // Always requires review initially
    };
  }
);


// --- EXPORTED ASYNC WRAPPER (The only export) ---
export async function generateLease(input: LeaseAgentInput): Promise<LeaseAgentOutput> {
  return await leaseAgentFlow(input);
}
