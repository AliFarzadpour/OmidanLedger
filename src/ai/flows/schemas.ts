import { z } from 'zod';

export const StatementInputSchema = z.object({
  statementDataUri: z
    .string()
    .describe(
      "The full content of the bank or credit card statement file, as a data URI. It must include a MIME type (e.g., 'data:application/pdf;base64,...' or 'data:text/csv;base64,...')."
    ),
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
  category: z
    .string()
    .describe(
      'The category of the transaction (e.g., Groceries, Utilities, Dining, Travel, Entertainment, Shopping, Bills, Income, Other).'
    ),
});
export type CategorizedTransaction = z.infer<
  typeof CategorizedTransactionSchema
>;

export const StatementOutputSchema = z.object({
  transactions: z.array(CategorizedTransactionSchema),
});
export type StatementOutput = z.infer<typeof StatementOutputSchema>;
