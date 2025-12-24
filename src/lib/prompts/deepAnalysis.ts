
import { z } from 'zod';

export const DeepCategorizationSchema = z.object({
  merchantName: z.string().describe("The clean merchant name (e.g., 'City of Anna')"),
  primaryCategory: z.enum(['Asset', 'Liability', 'Equity', 'Income', 'Expense']).describe("The L0 category."),
  secondaryCategory: z.string(),
  subcategory: z.string(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().describe("Why this category was chosen (e.g., 'City of... usually implies utilities')")
});

export const DEEP_ANALYSIS_PROMPT = `
You are a Senior Real Estate Accountant. Your primary job is to ensure every transaction is categorized under one of the five main accounting types: Asset, Liability, Equity, Income, or Expense.

Categorize this transaction accurately. Avoid 'General Expense' if possible.

**TRANSACTION:**
- Description: "{{description}}"
- Amount: {{amount}}
- Date: {{date}}

**PATTERNS:**
- "City of X" -> Expense > Utilities
- "Home Depot/Lowes" -> Expense > Repairs > Materials & Supplies
- "Macy's/Nordstrom" -> Equity > Owner Distribution > Personal Spending
- "7-Eleven/Shell" -> Expense > Travel > Fuel
- "Zelle Payment from..." -> Income > Rental Income
- "Payment to Credit Card" -> Liability > CC Payment > Internal Transfer

Return pure JSON.
`;
