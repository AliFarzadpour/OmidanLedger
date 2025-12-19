import { z } from 'zod';

export const DeepCategorizationSchema = z.object({
  merchantName: z.string().describe("The clean merchant name (e.g., 'City of Anna')"),
  primaryCategory: z.string(),
  secondaryCategory: z.string(),
  subcategory: z.string(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().describe("Why this category was chosen (e.g., 'City of... usually implies utilities')")
});

export const DEEP_ANALYSIS_PROMPT = `
You are a Senior Real Estate Accountant.
Categorize this transaction accurately. Avoid 'General Expense' if possible.

**TRANSACTION:**
- Description: "{{description}}"
- Amount: {{amount}}
- Date: {{date}}

**PATTERNS:**
- "City of X" -> Rent & Utilities (if bill) or Taxes (if permit)
- "Home Depot/Lowes" -> Repairs & Maintenance (Materials)
- "Macy's/Nordstrom" -> Owner's Draw (Personal)
- "7-Eleven/Shell" -> Fuel (if low amount)

Return pure JSON.
`;
