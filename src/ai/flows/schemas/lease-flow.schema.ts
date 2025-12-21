import { z } from 'zod';

export const LeaseAgentInputSchema = z.object({
  propertyId: z.string().describe('The Firestore ID of the property.'),
  tenantId: z.string().describe('The Firestore ID of the tenant.'),
  state: z.string().describe('The two-letter state code (e.g., "TX", "CA").'),
});
export type LeaseAgentInput = z.infer<typeof LeaseAgentInputSchema>;

export const LeaseAgentOutputSchema = z.object({
  leaseDocumentUrl: z.string().url().describe('The URL to the generated lease PDF.'),
  summary: z.string().describe('A brief summary of the generated lease.'),
  complianceStatus: z.enum(['compliant', 'review_needed']).describe('The compliance status of the document.'),
});
export type LeaseAgentOutput = z.infer<typeof LeaseAgentOutputSchema>;
