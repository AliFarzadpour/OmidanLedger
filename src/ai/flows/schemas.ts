import { z } from 'zod';

export const StatementInputSchema = z.object({
  statementDataUri: z
    .string()
    .describe(
      "The full content of the bank or credit card statement file, as a data URI. It must include a MIME type (e.g., 'data:application/pdf;base64,...' or 'data:text/csv;base64,...')."
    ),
  userId: z.string().describe("The user's Firebase UID."),
  userMappings: z.string().optional().describe("User's custom category mappings as a string."),
  userTrade: z.string().optional().describe('The industry or trade of the business (e.g., "Plumber", "Landlord").'),
  propertyId: z.string().optional().describe('The ID of the property this statement is for, if applicable.')
});
export type StatementInput = z.infer<typeof StatementInputSchema>;

export const CategorizedTransactionSchema = z.object({
  date: z.string().describe('The transaction date in YYYY-MM-DD format.'),
  description: z.string().describe('A brief description of the transaction.'),
  amount: z
    .number()
    .describe(
      'The transaction amount. Positive for income, negative for expenses.'
    ),
  primaryCategory: z.string().describe('The top-level category (e.g., "Operating Expenses").'),
  secondaryCategory: z.string().describe('The second-level category (e.g., "Marketing & Advertising").'),
  subcategory: z.string().describe('The most specific, third-level category (e.g., "Google Ads").'),
  confidence: z.number().describe('The confidence score (0-1) of the categorization.'),
  notes: z.string().describe('A brief note explaining the categorization reasoning.'),
  // NEW FIELDS FOR THE RESOLVER
  accountId: z.string().nullable().describe('The resolved Firestore ID of the linked ledger account.'),
  status: z.enum(['ready', 'needs_review']).describe('The status after attempting to resolve the account ID.'),
});
export type CategorizedTransaction = z.infer<
  typeof CategorizedTransactionSchema
>;

export const StatementOutputSchema = z.object({
  transactions: z.array(CategorizedTransactionSchema),
});
export type StatementOutput = z.infer<typeof StatementOutputSchema>;
