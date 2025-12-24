
import { z } from 'zod';

// This is the output schema for the entire deepCategorizeTransaction flow, not just the AI prompt.
export const DeepCategorizationSchema = z.object({
  merchantName: z.string(),
  categoryHierarchy: z.object({
      l0: z.string(),
      l1: z.string(),
      l2: z.string(),
      l3: z.string(),
  }),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  source: z.string(),
});


// This is the STRICT output format the AI MUST follow.
export const AICategoryOutputSchema = z.object({
    l0: z.string(),
    l1: z.string(),
    l2: z.string(),
    l3: z.string()
});


export const DEEP_ANALYSIS_PROMPT = `
You are a professional CPA. Categorize this transaction into a 4-level hierarchy based on IRS Schedule E.

LEVEL 0 (Account Type): Must be one of [Income, Expense, Asset, Liability, Equity].
LEVEL 1 (Group): A logical grouping like [Rental Income, Property Operations, Travel, Personal, Financing].
LEVEL 2 (Tax Line): MUST be a specific Schedule E Line [Line 5: Advertising, Line 6: Auto & Travel, Line 7: Cleaning and maintenance, Line 9: Insurance, Line 10: Legal and other professional fees, Line 11: Management fees, Line 12: Mortgage interest, Line 14: Repairs, Line 15: Supplies, Line 16: Taxes, Line 17: Utilities, Line 19: Other] or one of [Owner's Draw, Loan Paydown, Internal Transfer].
LEVEL 3 (Detail): Cleaned merchant name (e.g., 'Amazon' or 'City of Laguna').

CRITICAL RULES:
1. DO NOT use the words 'General', 'Miscellaneous', or 'Needs Review'. If you are unsure, you MUST default to 'Expense' > 'Property Operations' > 'Line 19: Other Expenses' > [Cleaned Merchant Name].
2. Clothing/Personal Shopping (Macy's, TJ Maxx) is ALWAYS Equity > Personal > Owner's Draw > [Merchant Name].
3. Grocery/Fast Food (Shake Shack, Kroger) defaults to Equity > Personal > Owner's Draw > [Merchant Name] unless 'Business' is in the description.
4. Home Depot/Lowe's is ALWAYS Expense > Property Operations > Line 14: Repairs > Supplies.
5. For credit card transactions, prioritize finding a business-related 'Expense' category before defaulting to 'Equity'.

Format JSON Output: { "l0": "...", "l1": "...", "l2": "...", "l3": "..." }

TRANSACTION:
- Description: "{{description}}"
- Amount: {{amount}}
- Date: {{date}}
`;
