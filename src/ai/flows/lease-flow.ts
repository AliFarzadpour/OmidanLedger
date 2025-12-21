'use server';
/**
 * @fileOverview An agentic workflow for generating state-compliant lease agreements.
 * This file has been modified to use live data from Firestore and a legal dictionary.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { 
  LeaseAgentInputSchema, 
  LeaseAgentOutputSchema,
  type LeaseAgentInput,
  type LeaseAgentOutput
} from './schemas/lease-flow.schema';
import { db } from '@/lib/admin-db';
import legalDictionary from '@/docs/legal/lease-dictionary.json';


// --- TOOLS ---

// Tool to fetch property & tenant data from Firestore
const getPropertyDataTool = ai.defineTool(
  {
    name: 'getPropertyData',
    description: 'Fetches property and tenant details from the database using their IDs.',
    inputSchema: z.object({ 
      propertyId: z.string().describe("The Firestore document ID for the property."), 
      tenantId: z.string().describe("The email address of the tenant, used as a temporary unique ID.") 
    }),
    outputSchema: z.any(),
  },
  async ({ propertyId, tenantId }) => {
    console.log(`Tool: Fetching data for Property ${propertyId} and Tenant ${tenantId}`);
    
    const propertyDoc = await db.collection('properties').doc(propertyId).get();
    if (!propertyDoc.exists) {
      throw new Error(`Property with ID ${propertyId} not found.`);
    }

    const propertyData = propertyDoc.data()!;
    const tenantData = propertyData.tenants?.find((t: any) => t.email === tenantId);

    if (!tenantData) {
        throw new Error(`Tenant with email ${tenantId} not found in property ${propertyId}.`);
    }

    return {
      propertyName: propertyData.name,
      propertyAddress: `${propertyData.address.street}, ${propertyData.address.city}, ${propertyData.address.state} ${propertyData.address.zip}`,
      rentAmount: tenantData.rentAmount,
      securityDeposit: propertyData.financials?.securityDeposit || 0,
      tenantName: `${tenantData.firstName} ${tenantData.lastName}`,
      tenantEmail: tenantData.email,
      leaseStartDate: tenantData.leaseStart,
      leaseEndDate: tenantData.leaseEnd,
    };
  }
);

// Tool to fetch state-specific legal clauses
const getLegalClausesTool = ai.defineTool(
  {
    name: 'getLegalClauses',
    description: 'Fetches state-specific legal clauses from the legal dictionary.',
    inputSchema: z.object({ state: z.string().length(2).describe("The two-letter state code, e.g., TX, CA.") }),
    outputSchema: z.any(),
  },
  async ({ state }) => {
    console.log(`Tool: Fetching legal clauses for ${state}`);
    const stateClauses = (legalDictionary.states as Record<string, any>)[state.toUpperCase()];
    if (!stateClauses) {
      throw new Error(`No legal data found for state: ${state}`);
    }
    return stateClauses;
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
    const propertyData = await getPropertyDataTool(input);
    const legalClauses = await getLegalClausesTool({ state: input.state });

    // 2. "Stitch" the Lease with Gemini
    const { text: leaseText } = await ai.generate({
      prompt: `
        You are a paralegal AI specializing in real estate law. Your task is to assemble a simple but valid lease agreement using the provided data.

        **Property & Tenant Information:**
        - Property: ${propertyData.propertyName}
        - Address: ${propertyData.propertyAddress}
        - Tenant: ${propertyData.tenantName} (${propertyData.tenantEmail})
        - Rent: $${propertyData.rentAmount}/month
        - Security Deposit: $${propertyData.securityDeposit}
        - Term: ${propertyData.leaseStartDate} to ${propertyData.leaseEndDate}

        **State-Specific Legal Requirements for ${input.state.toUpperCase()}:**
        - Security Deposit Rules: ${legalClauses.security_deposit.notes} (Return Deadline: ${legalClauses.security_deposit.return_deadline_days} days)
        - Late Fee Rules: ${legalClauses.late_fees.notes} (Max Fee: ${legalClauses.late_fees.max_fee})
        - Landlord Entry Rules: ${legalClauses.notice_to_enter.notes} (Standard Notice: ${legalClauses.notice_to_enter.standard_notice_hours} hours)

        **Instructions:**
        Generate the full text of a residential lease agreement incorporating all the data above.
        Structure it with clear headings (e.g., "1. Parties", "2. Property", "3. Term", "4. Rent", "5. Security Deposit", etc.).
        Ensure the clauses for security deposit, late fees, and landlord's notice to enter are worded to be compliant with the state-specific rules provided.
        The output should be only the text of the lease agreement.
      `,
    });

    if (!leaseText) {
        throw new Error("AI failed to generate lease text.");
    }
    
    console.log('Generated Lease Text:', leaseText);
    
    // The PDF generation has been removed as it was causing build errors.
    // In a real application, this is where you would convert `leaseText` to a PDF
    // and upload it to storage. For now, we return a placeholder.
    const pdfDataUri = "data:application/pdf;base64,";


    return {
      leaseDocumentUrl: pdfDataUri,
      summary: `Lease draft created for ${propertyData.tenantName} at ${propertyData.propertyName}.`,
      complianceStatus: 'review_needed', // Always requires review initially
    };
  }
);


// --- EXPORTED ASYNC WRAPPER (The only export) ---
export async function generateLease(input: LeaseAgentInput): Promise<LeaseAgentOutput> {
  return await leaseAgentFlow(input);
}
