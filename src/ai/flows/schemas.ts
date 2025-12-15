import { z } from 'genkit';

// Input: The file or text to process
export const StatementInputSchema = z.object({
  statementDataUri: z.string().describe('The base64 data URI of the file (PDF/CSV).'),
  userId: z.string().describe('The Firebase UID of the user.'),
  userTrade: z.string().optional().describe('The context/trade of the user (e.g. Plumber).'),
  userMappings: z.string().optional().describe("User's custom category mappings as a string."),
  propertyId: z.string().optional().describe('The ID of the property this statement is for, if applicable.')
});
export type StatementInput = z.infer<typeof StatementInputSchema>;


// This is the shape of what the AI is expected to return initially
const AIGeneratedTransactionSchema = z.object({
    date: z.string().describe('YYYY-MM-DD format'),
    description: z.string(),
    amount: z.number(),
    primaryCategory: z.string(),
    secondaryCategory: z.string(),
    subcategory: z.string(),
    confidence: z.number(),
    notes: z.string(),
});

// This is the final shape of the transaction after our code processes it
export const CategorizedTransactionSchema = AIGeneratedTransactionSchema.extend({
    // FIX: Make these OPTIONAL so the AI doesn't crash validation
    accountId: z.string().optional().describe('The resolved Firestore ID.'),
    status: z.enum(['ready', 'needs_review', 'review']).optional().describe('Processing status'),
});
export type CategorizedTransaction = z.infer<typeof CategorizedTransactionSchema>;


// The final output schema uses the final transaction shape
export const StatementOutputSchema = z.object({
  transactions: z.array(CategorizedTransactionSchema),
});
export type StatementOutput = z.infer<typeof StatementOutputSchema>;
