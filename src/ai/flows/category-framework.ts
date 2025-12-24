

// THIS IS THE UNIVERSAL SOURCE OF TRUTH FOR THE 4-LEVEL TAXONOMY
// IT IS ALIGNED WITH IRS SCHEDULE E FOR REAL ESTATE PROFESSIONALS.
export const MasterCategoryFramework = `
// =================================================================================================
// LEVEL 0: INCOME (REVENUE)
// =================================================================================================
1. Income
  1.1. Rental Income
    - Line 3: Rents Received
  1.2. Other Income
    - Line 3: Rents Received (for other income like parking, laundry)
    - Line 4: Royalties
    - Not Mapped: Interest Income (Financial, not Operating)
    - Not Mapped: Refunds/Credits

// =================================================================================================
// LEVEL 0: EXPENSE (DEDUCTIONS)
// =================================================================================================
2. Expense
  2.1. Advertising
    - Line 5: Advertising
  2.2. Auto & Travel
    - Line 6: Auto and travel
  2.3. Cleaning & Maintenance
    - Line 7: Cleaning and maintenance
  2.4. Commissions
    - Line 8: Commissions
  2.5. Insurance
    - Line 9: Insurance
  2.6. Legal & Professional
    - Line 10: Legal and other professional fees
  2.7. Management
    - Line 11: Management fees
  2.8. Financing
    - Line 12: Mortgage interest paid to banks, etc.
    - Line 13: Other interest
  2.9. Repairs
    - Line 14: Repairs
  2.10. Office Admin
    - Line 15: Supplies
    - Line 19: Other (for office-related expenses like software, postage)
  2.11. Taxes
    - Line 16: Taxes
  2.12. Utilities
    - Line 17: Utilities
  2.13. Depreciation
    - Line 18: Depreciation expense or depletion
  2.14. Other Expenses
    - Line 19: Other

// =================================================================================================
// LEVEL 0: ASSET (BALANCE SHEET - NOT ON P&L)
// =================================================================================================
3. Asset
  3.1. Cash Movement
    - Internal Transfer
  3.2. Fixed Assets
    - Property Purchase
    - Equipment Purchase
  3.3. Other Assets
    - Security Deposit Paid

// =================================================================================================
// LEVEL 0: LIABILITY (BALANCE SHEET - NOT ON P&L)
// =================================================================================================
4. Liability
  4.1. Debt Service
    - Loan Paydown
    - Mortgage Principal
    - Vehicle Loan
  4.2. CC Payment
    - Internal Transfer
  4.3. Tenant Deposits
    - Security Deposits Held
  
// =================================================================================================
// LEVEL 0: EQUITY (BALANCE SHEET - NOT ON P&L)
// =================================================================================================
5. Equity
  5.1. Owner Contribution
    - Owner Investment
  5.2. Owner Distribution
    - Personal Draw
    - Non-Deductible
`;

    