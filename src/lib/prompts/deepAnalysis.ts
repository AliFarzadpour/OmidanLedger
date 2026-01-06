
import { z } from 'zod';
import { CATEGORY_MAP } from '@/lib/categories';

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
You are a professional CPA. Categorize this transaction into a 4-level hierarchy based on the provided JSON category map.

**CATEGORY MAP (Source of Truth):**
${JSON.stringify(CATEGORY_MAP, null, 2)}

**Instructions & Rules:**
1.  **Analyze**: Look at the transaction description, amount, and date.
2.  **Select L0**: Choose the top-level category from the map: [INCOME, OPERATING EXPENSE, EXPENSE, ASSET, LIABILITY, EQUITY].
3.  **Select L1**: Based on L0, choose the appropriate L1 group from the map.
4.  **Select L2**: Based on L1, choose the most specific L2 tax line from the map (e.g., "Schedule E, Line 14 — Repairs").
5.  **Determine L3**: This should be the cleaned-up merchant or vendor name (e.g., "The Home Depot", "City of Austin Utilities").

**CRITICAL RULES (Non-negotiable):**
1.  **Default for Ambiguity**: If unsure, you MUST default to 'OPERATING EXPENSE' > 'Property Operations (Rentals)' > 'Schedule E, Line 19 — Other'.
2.  **Personal Spending**: General retail (Macy's, TJ Maxx), restaurants, and groceries are ALWAYS 'EQUITY' > 'Owner / Shareholder Equity' > 'Owner Distributions' unless 'Business' is explicitly in the description.
3.  **Hardware Stores**: Home Depot, Lowe's, etc., are ALWAYS 'OPERATING EXPENSE' > 'Property Operations (Rentals)' > 'Schedule E, Line 14 — Repairs'.
4.  **No New Categories**: You MUST select from the provided map. Do not invent new categories.

**Format JSON Output:** { "l0": "...", "l1": "...", "l2": "...", "l3": "..." }

---
**TRANSACTION TO ANALYZE:**
- Description: "{{description}}"
- Amount: {{amount}}
- Date: {{date}}
---
`;
