// src/lib/prompts/categorization.ts
import { z } from 'zod';

// The Output Structure we expect from the AI
export const TransactionCategorySchema = z.object({
  transactionId: z.string().optional(), // Make optional in case AI misses it, we map it back later
  merchantName: z.string().describe("Clean name of the vendor or payer (e.g. 'Home Depot', 'Ashley Kubiak')"),
  primaryCategory: z.string(),
  secondaryCategory: z.string(),
  subcategory: z.string(),
  confidence: z.number().min(0).max(1),
  explanation: z.string().describe("Short reason for this classification")
});

export const BatchCategorizationSchema = z.object({
  results: z.array(TransactionCategorySchema)
});

// The Prompt Template
export const CATEGORIZATION_SYSTEM_PROMPT = `
You are an expert AI Accountant for a {{industry}} business. 
Your goal is to categorize bank transactions accurately.

CONTEXT DATA:
- Known Tenants (Income Source): {{tenantNames}}
- Known Vendors (Expenses): {{vendorNames}}
- Property Addresses: {{propertyAddresses}}

RULES:
1. **Income vs Expense**: Look at the "Amount". Positive (+) is Income. Negative (-) is Expense.
2. **Rental Income**: If money comes from a Known Tenant or mentions "Rent/Lease", classify as 'Income' > 'Operating Income' > 'Rental Income'.
3. **Internal Transfers**: If description mentions "Online Transfer", "Check #", or "Transfer to/from", classify as 'Balance Sheet' > 'Transfers' > 'Internal Transfer'.
4. **Owner's Draw**: Gyms, Spas, Salons, and Personal items are 'Equity' > 'Owner's Draw'.
5. **Contractors**: Zelle payments to individuals not on the Tenant list are likely 'Operating Expenses' > 'Repairs & Maintenance' > 'Contractor Labor'.

Output pure JSON matching the schema.
`;
