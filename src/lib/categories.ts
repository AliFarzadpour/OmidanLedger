
// src/lib/categories.ts

export const CATEGORY_MAP = {
  "INCOME": {
    "Rental Income": [
      "Schedule E, Line 3 — Rents Received",
      "Schedule E, Line 4 — Royalties Received",
    ],
    "Business Income": [
      "Schedule C, Line 1 — Gross Receipts / Sales",
    ],
    "Other Income": [
      "Schedule B — Interest Income",
      "Schedule B — Dividends",
      "Other Income — Refunds / Rebates / Reimbursements",
      "Other Income — Insurance Proceeds",
      "Other Income — Miscellaneous Income",
    ],
  },
  "OPERATING EXPENSE": {
    "Property Operations (Rentals)": [
      "Schedule E, Line 5 — Advertising",
      "Schedule E, Line 6 — Auto & Travel",
      "Schedule E, Line 7 — Cleaning & Maintenance",
      "Schedule E, Line 8 — Commissions",
      "Schedule E, Line 9 — Insurance",
      "Schedule E, Line 10 — Legal & Other Professional Fees",
      "Schedule E, Line 11 — Management Fees",
      "Schedule E, Line 12 — Mortgage Interest Paid to Banks",
      "Schedule E, Line 13 — Other Interest",
      "Schedule E, Line 14 — Repairs",
      "Schedule E, Line 15 — Supplies",
      "Schedule E, Line 16 — Taxes",
      "Schedule E, Line 17 — Utilities",
      "Schedule E, Line 18 — Depreciation Expense / Depletion",
      "Schedule E, Line 19 — Other",
    ],
    "Office & Administrative (Business)": [
      "Schedule C, Line 18 — Office Expense",
      "Schedule C, Line 22 — Supplies",
      "Schedule C, Line 25 — Utilities",
      "Schedule C, Line 27a — Other Expenses",
      "Schedule C, Line 27a — Software / Subscriptions",
      "Schedule C, Line 27a — Bank Charges / Service Fees",
    ],
    "Payroll & People": [
      "Schedule C, Line 26 — Wages",
      "Schedule C, Line 23 — Taxes & Licenses",
      "Schedule C, Line 14 — Employee Benefit Programs",
      "Schedule C, Line 19 — Pension & Profit-Sharing Plans",
      "Schedule C, Line 11 — Contract Labor",
    ],
  },
  "EXPENSE": {
    "Marketing & Sales": [
      "Schedule C, Line 8 — Advertising",
      "Schedule C, Line 27a — Other Expenses (Marketing)",
    ],
    "Professional Services": [
      "Schedule C, Line 17 — Legal & Professional Services",
      "Schedule E, Line 10 — Legal & Other Professional Fees",
    ],
    "Vehicle & Travel": [
      "Schedule C, Line 9 — Car & Truck Expenses",
      "Schedule C, Line 24a — Travel",
      "Schedule C, Line 24b — Meals (50% deductible)",
    ],
    "Cost of Goods Sold": [
      "Schedule C, Part III — Cost of Goods Sold (COGS)",
    ],
  },
  "ASSET": {
    "Cash & Banking": ["Balance Sheet — Cash & Cash Equivalents"],
    "Accounts Receivable": ["Balance Sheet — Accounts Receivable"],
    "Fixed Assets": [
      "Balance Sheet — Fixed Assets (Depreciable)",
      "Balance Sheet — Land (Non-Depreciable)",
    ],
    "Other Assets": [
      "Balance Sheet — Prepaid Expenses",
      "Balance Sheet — Deposits Paid",
      "Balance Sheet — Notes Receivable",
      "Balance Sheet — Investments",
    ],
  },
  "LIABILITY": {
    "Short-Term Liabilities": [
      "Balance Sheet — Accounts Payable",
      "Balance Sheet — Credit Cards Payable",
      "Balance Sheet — Accrued Expenses",
      "Balance Sheet — Sales Tax Payable",
      "Balance Sheet — Payroll Liabilities",
      "Balance Sheet — Unearned / Deferred Revenue",
    ],
    "Long-Term Liabilities": [
      "Balance Sheet — Mortgage Payable",
      "Balance Sheet — Notes Payable / Term Loans",
      "Balance Sheet — SBA Loans",
      "Balance Sheet — Vehicle Loans",
    ],
    "Tenant / Client Funds": [
      "Balance Sheet — Security Deposits Held",
      "Balance Sheet — Prepaid Rent / Tenant Credits",
      "Balance Sheet — Client Retainers",
    ],
  },
  "EQUITY": {
    "Owner / Shareholder Equity": [
      "Equity — Owner Contributions",
      "Equity — Owner Distributions",
      "Equity — Shareholder Loans In",
      "Equity — Shareholder Loans Out",
    ],
    "Retained Earnings": [
      "Equity — Retained Earnings (Prior Year)",
      "Equity — Net Income (Current Year)",
    ],
  },
};

export type CategoryMap = typeof CATEGORY_MAP;
export type L0Category = keyof CategoryMap;
export type L1Category<T extends L0Category> = keyof CategoryMap[T];
export type L2Category<T extends L0Category, U extends L1Category<T>> = CategoryMap[T][U][number];
