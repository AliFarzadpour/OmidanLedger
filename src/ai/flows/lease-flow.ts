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
import legalDictionary from '../../../docs/legal/lease-dictionary.json';
import jsPDF from 'jspdf';
import { getStorage } from 'firebase-admin/storage';
import { v4 as uuidv4 } from 'uuid';


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
      userId: propertyData.userId,
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
        You are a paralegal AI specializing in real estate law. Your task is to assemble a professional, well-formatted, and complete residential lease agreement using the provided data.

        **Data Provided:**
        - **Property:** ${propertyData.propertyName} at ${propertyData.propertyAddress}
        - **Tenant:** ${propertyData.tenantName} (${propertyData.tenantEmail})
        - **Landlord:** [Your Company Name Here] (You will act as the landlord)
        - **Rent:** $${propertyData.rentAmount}/month, due on the 1st.
        - **Security Deposit:** $${propertyData.securityDeposit}
        - **Lease Term:** From ${propertyData.leaseStartDate} to ${propertyData.leaseEndDate}
        - **Governing State:** ${input.state.toUpperCase()}
        - **State-Specific Rules:**
          - **Security Deposit:** ${legalClauses.security_deposit.notes} (Return Deadline: ${legalClauses.security_deposit.return_deadline_days} days)
          - **Late Fees:** ${legalClauses.late_fees.notes} (Max Fee: ${legalClauses.late_fees.max_fee})
          - **Landlord Entry:** ${legalClauses.notice_to_enter.notes} (Standard Notice: ${legalClauses.notice_to_enter.standard_notice_hours} hours)

        **Formatting and Content Instructions:**
        1.  **Title:** Start with a clear title: "Residential Lease Agreement".
        2.  **Structure:** Use clear, numbered headings for each section (e.g., "1. PARTIES", "2. PREMISES", "3. TERM", etc.).
        3.  **Completeness:** Generate a complete lease agreement. After the "Security Deposit" section, you MUST include the following standard clauses:
            - **USE OF PREMISES:** The premises shall be used and occupied by Tenant exclusively as a private single-family residence.
            - **UTILITIES:** Tenant shall be responsible for arranging and paying for all utility services required on the premises.
            - **MAINTENANCE AND REPAIR:** Tenant will, at their sole expense, keep and maintain the premises in good, clean, and sanitary condition.
            - **DEFAULT:** If Tenant fails to pay rent or defaults on any other term, Landlord may give written notice of the default and intent to terminate the Lease.
            - **GOVERNING LAW:** This Lease shall be governed by the laws of the State of ${input.state.toUpperCase()}.
            - **ENTIRE AGREEMENT:** This document constitutes the entire agreement between the parties.
        4.  **Signature Block:** Conclude with a proper signature section for both Landlord and Tenant, including lines for name, signature, and date.
        5.  **Professional Tone:** The output must be only the full, final text of the lease agreement. Do not include any conversational text, introductions, or summaries.
      `,
    });

    if (!leaseText) {
        throw new Error("AI failed to generate lease text.");
    }
    
    // 3. Generate PDF
    const doc = new jsPDF();
    const splitText = doc.splitTextToSize(leaseText, 180);
    doc.text(splitText, 15, 20);
    const pdfOutput = doc.output('arraybuffer');
    const pdfBuffer = Buffer.from(pdfOutput);

    // 4. Upload to Firebase Storage
    const storage = getStorage();
    const bucket = storage.bucket(); 
    const documentId = uuidv4();
    const fileName = `lease-agreement-${input.tenantId.replace(/[^a-zA-Z0-9]/g, '_')}-${documentId}.pdf`;
    const storagePath = `property_documents/${input.propertyId}/${fileName}`;
    const file = bucket.file(storagePath);

    await file.save(pdfBuffer, {
        metadata: {
            contentType: 'application/pdf',
        },
    });

    const [downloadURL] = await file.getSignedUrl({
        action: 'read',
        expires: '03-09-2491'
    });


    // 5. Save Metadata to Firestore
    const docRef = db.collection('properties').doc(input.propertyId).collection('documents').doc(documentId);
    await docRef.set({
        id: documentId,
        propertyId: input.propertyId,
        userId: propertyData.userId,
        fileName: fileName,
        fileType: 'lease',
        description: `Auto-generated lease for ${propertyData.tenantName}`,
        downloadUrl: downloadURL,
        storagePath: storagePath,
        uploadedAt: new Date().toISOString(),
    });


    return {
      leaseDocumentUrl: downloadURL,
      summary: `Lease draft created and saved to documents tab for ${propertyData.tenantName} at ${propertyData.propertyName}.`,
      complianceStatus: 'review_needed', 
    };
  }
);


// --- EXPORTED ASYNC WRAPPER (The only export) ---
export async function generateLease(input: LeaseAgentInput): Promise<LeaseAgentOutput> {
  return await leaseAgentFlow(input);
}
