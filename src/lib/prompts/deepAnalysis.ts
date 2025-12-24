
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

LEVEL 0 (Account Type): Must be [Operating Expense, Equity, Income, or Asset].
LEVEL 1 (Group): Must be [Property Operations, Rent & Utilities, Personal, or Marketing].
LEVEL 2 (Tax Line): MUST be a specific Schedule E Line [Line 6: Travel, Line 14: Repairs, Line 16: Taxes, Line 17: Utilities, Line 19: Other] or [Owner's Draw].
LEVEL 3 (Detail): Cleaned merchant name (e.g., 'Amazon' or 'City of Laguna').

RULES:
1. NEVER use 'General' or 'Needs Review'. If unsure, pick the closest tax-compliant category.
2. Clothing/Personal Shopping (Macy's, TJ Maxx, Calvin Klein) is ALWAYS Equity > Personal > Owner's Draw.
3. Grocery/Fast Food (Shake Shack, Kroger) defaults to Equity > Personal > Owner's Draw unless 'Business' is in description.
4. Home Depot/Lowe's is ALWAYS Operating Expense > Property Operations > Line 14: Repairs > Supplies.

Format JSON Output: { "l0": "...", "l1": "...", "l2": "...", "l3": "..." }

TRANSACTION:
- Description: "{{description}}"
- Amount: {{amount}}
- Date: {{date}}
`;
