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
import autoTable from 'jspdf-autotable';
import { getStorage } from 'firebase-admin/storage';
import { v4 as uuidv4 } from 'uuid';


// --- TOOLS ---

// Tool to fetch property & tenant data from Firestore
const getPropertyDataTool = ai.defineTool(
  {
    name: 'getPropertyData',
    description: 'Fetches property, tenant, and landlord details from the database using their IDs.',
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

    let landlordName = 'Landlord';
    if (propertyData.userId) {
        const userDoc = await db.collection('users').doc(propertyData.userId).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            landlordName = userData?.businessProfile?.businessName || userData?.name || 'Landlord';
        }
    }


    return {
      userId: propertyData.userId,
      landlordName: landlordName,
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
        
        **Formatting and Content Instructions:**
        1.  **Title:** Start with a clear title: "Residential Lease Agreement".
        2.  **Hierarchical Numbering:** Use a clear, hierarchical numbering system for each section (e.g., "1.0 PARTIES", "1.1 Landlord", "1.2 Tenant", "2.0 PREMISES", etc.). Main sections should be numbered X.0 and be in ALL CAPS.
        3.  **Completeness:** Generate a complete lease agreement. You MUST include the following standard clauses, each with its own hierarchical number:
            - **PARTIES:** List the Landlord as "${propertyData.landlordName}" and Tenant as "${propertyData.tenantName}".
            - **PREMISES:** State the address is ${propertyData.propertyAddress}.
            - **TERM:** State the lease term is from ${propertyData.leaseStartDate} to ${propertyData.leaseEndDate}.
            - **RENT:** State the rent is $${propertyData.rentAmount} per month, due on the 1st.
            - **SECURITY DEPOSIT:** State the deposit is $${propertyData.securityDeposit}. Incorporate this note: "${legalClauses.security_deposit.notes}".
            - **LATE FEES:** Incorporate this rule: "${legalClauses.late_fees.notes}".
            - **NOTICE TO ENTER:** Incorporate this rule: "${legalClauses.notice_to_enter.notes}".
            - **USE OF PREMISES:** The premises shall be used and occupied by Tenant exclusively as a private single-family residence.
            - **UTILITIES:** Tenant shall be responsible for arranging and paying for all utility services required on the premises.
            - **MAINTENANCE AND REPAIR:** Tenant will, at their sole expense, keep and maintain the premises in good, clean, and sanitary condition.
            - **DEFAULT:** If Tenant fails to pay rent or defaults on any other term, Landlord may give written notice of the default and intent to terminate the Lease.
            - **GOVERNING LAW:** This Lease shall be governed by the laws of the State of ${input.state.toUpperCase()}.
            - **ENTIRE AGREEMENT:** This document constitutes the entire agreement between the parties.
        4.  **Signature Block:** Conclude with a proper signature section for both Landlord and Tenant, including lines for name, signature, and date.
        5.  **Professional Tone:** The output must be only the full, final text of the lease agreement. Do not include any conversational text, introductions, or summaries. Just the lease content.
      `,
    });

    if (!leaseText) {
        throw new Error("AI failed to generate lease text.");
    }
    
    // 3. Generate PDF
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    const margin = 20; // 20mm margin
    
    const addPageDecorations = (data: any) => {
      const pageCount = doc.internal.getNumberOfPages();
      doc.setFontSize(9);
      doc.setTextColor(150);
      
      // Header
      doc.text(`Lease Agreement | ${propertyData.propertyAddress}`, margin, 15);

      // Footer
      const footerText = `Page ${data.pageNumber} of ${pageCount}`;
      doc.text(footerText, pageWidth / 2, pageHeight - 10, { align: 'center' });
    };

    doc.setFont('times', 'normal');
    doc.setFontSize(22);
    doc.text("Residential Lease Agreement", pageWidth / 2, 30, { align: 'center' });
    doc.setDrawColor(200);
    doc.line(margin, 35, pageWidth - margin, 35);
    
    // Parse the AI's text into a format for autoTable
    const body = leaseText.split('\n').filter(line => line.trim() !== '').map(line => {
      const trimmedLine = line.trim();
      // Check if the line is a main section header (e.g., "1.0 PARTIES")
      if (trimmedLine.match(/^\d+\.0\s[A-Z\s,()-]+$/)) {
        return [{ content: trimmedLine, styles: { fontStyle: 'bold', fontSize: 14, cellPadding: { top: 6, bottom: 2 } } }];
      }
      // Check if the line is a subsection header (e.g., "1.1 Landlord")
      else if (trimmedLine.match(/^\d+\.\d+\s/)) {
        return [{ content: trimmedLine, styles: { fontStyle: 'bold', fontSize: 11, cellPadding: { top: 3, bottom: 1 } } }];
      }
      // Otherwise, it's body text
      else {
        return [{ content: trimmedLine, styles: { fontSize: 11 } }];
      }
    });

    autoTable(doc, {
        startY: 45,
        theme: 'plain',
        body: body,
        didDrawPage: addPageDecorations,
        margin: { top: 25, bottom: 20, left: margin, right: margin }
    });

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

    // Make the file publicly readable to get a permanent URL
    await file.makePublic();

    // Get the public URL. This is now a permanent link.
    const downloadURL = file.publicUrl();

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
      summary: `Lease draft created for ${propertyData.tenantName} at ${propertyData.propertyName}.`,
      complianceStatus: 'review_needed', 
    };
  }
);


// --- EXPORTED ASYNC WRAPPER (The only export) ---
export async function generateLease(input: LeaseAgentInput): Promise<LeaseAgentOutput> {
  return await leaseAgentFlow(input);
}
