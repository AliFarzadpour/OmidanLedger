

// scripts/migrate-account-data.ts
import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

// --- CONFIGURATION ---
const TARGET_USER_ID = 'QsMUGG2ldOa0bpRHJCnVP3pKyIv1';

// 1. Initialize Admin SDK
function initializeAdminApp() {
  const serviceAccountPath = path.join(process.cwd(), 'service-account.json');
  try {
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = require(serviceAccountPath);
      if (admin.apps.length === 0) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
      }
    } else {
        throw new Error("service-account.json not found. Please ensure it exists in your project root.");
    }
  } catch (error) {
    console.error("Error initializing Firebase Admin SDK:", error);
    process.exit(1);
  }
}

const db = admin.firestore();


// 2. The Master Mapping Table from old categories to the new 4-level structure
const mappingTable: Record<string, {l0: string, l1: string, l2: string, l3: string}> = {
  // --- INCOME ---
  "Income > Rental Income > Adelyn Rental Income": { l0: "Income", l1: "Rental Income", l2: "Line 3: Rents Received", l3: "Adelyn" },
  "Income > Rental Income > Dallas Rental Income": { l0: "Income", l1: "Rental Income", l2: "Line 3: Rents Received", l3: "Dallas" },
  "Income > Rental Income > Lewisville Rent Income": { l0: "Income", l1: "Rental Income", l2: "Line 3: Rents Received", l3: "Lewisville" },
  "Income > Rental Income > PeachBush - Rents Received": { l0: "Income", l1: "Rental Income", l2: "Line 3: Rents Received", l3: "PeachBush" },
  "Income > Rental Income > Plano Office - Rents Received": { l0: "Income", l1: "Rental Income", l2: "Line 3: Rents Received", l3: "Plano Office" },
  "Income > Rental Income > Richardson Rent Income": { l0: "Income", l1: "Rental Income", l2: "Line 3: Rents Received", l3: "Richardson" },
  "Income > Operating Income > Talia Rental Income": { l0: "Income", l1: "Rental Income", l2: "Line 3: Rents Received", l3: "Talia" },
  "Income > Refund > Refund": { l0: "Income", l1: "Adjustments", l2: "Line 4: Royalties", l3: "Refund" },
  "Refund > Income Rufund > Income Refund": { l0: "Income", l1: "Adjustments", l2: "Line 4: Royalties", l3: "Income Refund" },
  "Office & Administrative > Software & Subscriptions > Account Verification": { l0: "Income", l1: "Adjustments", l2: "Line 4: Royalties", l3: "Verification Credit" },
  "Interest Income > Bank Interest": { l0: "Income", l1: "Non-Operating", l2: "Line 13: Other interest", l3: "Bank Interest" },
  "Income > Non-Operating > Bank Interest": { l0: "Income", l1: "Non-Operating", l2: "Line 13: Other interest", l3: "Bank Interest" },
  
  // --- EXPENSES ---
  "Operating Expenses > Repairs & Maintenance > Repairs & Maintenance": { l0: "Expense", l1: "Repairs", l2: "Line 14: Repairs", l3: "General" },
  "Operating Expenses > Repairs & Maintenance > Talia - Pool Maintenance": { l0: "Expense", l1: "Repairs", l2: "Line 7: Cleaning and maintenance", l3: "Pool Service" },
  "Operating Expenses > Repairs & Maintenance > Lawn Mowing Services": { l0: "Expense", l1: "Repairs", l2: "Line 7: Cleaning and maintenance", l3: "Lawn Care" },
  "Repairs & Maintenance > Property Repairs > Handyman Services": { l0: "Expense", l1: "Repairs", l2: "Line 14: Repairs", l3: "Handyman" },
  "Repairs & Maintenance > Repairs > Adelyn - Repairs & Maintenance": { l0: "Expense", l1: "Repairs", l2: "Line 14: Repairs", l3: "Adelyn Repair" },
  "Repairs & Maintenance > Repairs > Helmoken - Repairs & Maintenance": { l0: "Expense", l1: "Repairs", l2: "Line 14: Repairs", l3: "Helmoken Repair" },
  "Real Estate Operations > Property Expenses > Repairs & Maintenance": { l0: "Expense", l1: "Repairs", l2: "Line 14: Repairs", l3: "General Maint" },
  "Operating Expense > Repairs & Maintenance > Property Repair & Maintenance": { l0: "Expense", l1: "Repairs", l2: "Line 14: Repairs", l3: "Property Maint" },
  "Expenses > Utilities > Talia - Water": { l0: "Expense", l1: "Utilities", l2: "Line 17: Utilities", l3: "Water" },
  "Operating Expenses > Utilities > Electricity": { l0: "Expense", l1: "Utilities", l2: "Line 17: Utilities", l3: "Electricity" },
  "Operating Expenses > Utilities > Phone/Internet": { l0: "Expense", l1: "Utilities", l2: "Line 17: Utilities", l3: "Phone/Internet" },
  "Operating Expenses > Communications & Utilities > Telecommunications": { l0: "Expense", l1: "Utilities", l2: "Line 17: Utilities", l3: "Telecom" },
  "Rent & Utilities > Utilities > Telecommunications/Internet": { l0: "Expense", l1: "Utilities", l2: "Line 17: Utilities", l3: "Internet" },
  "Operating Expenses > Insurance > Property Insurance": { l0: "Expense", l1: "Insurance", l2: "Line 9: Insurance", l3: "Property" },
  "Operating Expenses > Property Insurance > Building Insurance": { l0: "Expense", l1: "Insurance", l2: "Line 9: Insurance", l3: "Building" },
  "Operating Expenses > Taxes > Property Tax": { l0: "Expense", l1: "Taxes", l2: "Line 16: Taxes", l3: "Property Tax" },
  "Professional Fees > Financial Services > Accounting & Tax preparation": { l0: "Expense", l1: "Legal & Professional", l2: "Line 10: Legal and other professional fees", l3: "Accounting" },
  "Professional Services > Accounting & Tax Services > Tax Consulting": { l0: "Expense", l1: "Legal & Professional", l2: "Line 10: Legal and other professional fees", l3: "Tax Prep" },
  "Operating Expenses > Cosoltation > Contractors and consultation": { l0: "Expense", l1: "Legal & Professional", l2: "Line 10: Legal and other professional fees", l3: "Contractors" },
  "Operating Expense > Hoa > Hoa": { l0: "Expense", l1: "Other Expenses", l2: "Line 19: Other", l3: "HOA Fees" },
  "Operating Expense > Property Management > HOA Fees": { l0: "Expense", l1: "Other Expenses", l2: "Line 19: Other", l3: "HOA Fees" },
  "Real Estate > Property Operating Expenses > Homeowners Association (HOA) Fees": { l0: "Expense", l1: "Other Expenses", l2: "Line 19: Other", l3: "HOA Fees" },
  "Operating Expenses > Office Expenses > Office Supplies": { l0: "Expense", l1: "Office Admin", l2: "Line 15: Supplies", l3: "Office Supplies" },
  "Office Expenses > Supplies > Groceries/Beverages": { l0: "Expense", l1: "Office Admin", l2: "Line 15: Supplies", l3: "Office Food" },
  "Operating Expenses > Software & Subscriptions > Software & Subscriptions": { l0: "Expense", l1: "Office Admin", l2: "Line 19: Other", l3: "Software" },
  "Operating Expenses > Software & Subscriptions > Digital Services": { l0: "Expense", l1: "Office Admin", l2: "Line 19: Other", l3: "Digital Services" },
  "Technology > Software & Subscriptions > Cloud Storage & Services": { l0: "Expense", l1: "Office Admin", l2: "Line 19: Other", l3: "Cloud Storage" },
  "Technology & Software > Software & Subscriptions > Digital Content & Services": { l0: "Expense", l1: "Office Admin", l2: "Line 19: Other", l3: "Digital Services" },
  "Operating Expenses > Meals & Entertainment > Food & Beverage": { l0: "Expense", l1: "Meals", l2: "Line 19: Other", l3: "Business Meals" },
  "Transportation > Vehicle Expenses > Tolls": { l0: "Expense", l1: "Travel", l2: "Line 6: Auto and travel", l3: "Tolls" },
  "Transportation > Travel Expenses > Transportation": { l0: "Expense", l1: "Travel", l2: "Line 6: Auto and travel", l3: "Travel" },
  "Real Estate > Property Management > Fees & Services": { l0: "Expense", l1: "Management", l2: "Line 11: Management fees", l3: "Property Mgmt" },
  "Expenses > Mortgage Interest > Adelyn - Mortgage Interest Paid": { l0: "Expense", l1: "Financing", l2: "Line 12: Mortgage interest paid to banks, etc.", l3: "Adelyn Mortgage" },
  "Operating Expenses > Bank & Credit Card Fees > Transaction Fee": { l0: "Expense", l1: "Financing", l2: "Line 13: Other interest", l3: "Bank Fees" },

  // --- BALANCE SHEET: LIABILITIES & ASSETS ---
  "Liability > Debt Service > Mortgage Principal": { l0: "Liability", l1: "Loan Paydown", l2: "Mortgage Principal", l3: "Principal Paydown" },
  "Mortgage & Loans > Principal & Interest > Loan Payment": { l0: "Liability", l1: "Loan Paydown", l2: "Mortgage Principal", l3: "Principal Paydown" },
  "Debt Service > Loan Payments > SBA EIDL Loan Payment": { l0: "Liability", l1: "Loan Paydown", l2: "SBA Loan", l3: "SBA EIDL" },
  "Transportation > Vehicle Expenses > Car & Truck": { l0: "Liability", l1: "Loan Paydown", l2: "Vehicle Loan", l3: "Auto Payment" },
  "Liability > Deposit > Security Deposit Received": { l0: "Liability", l1: "Tenant Deposits", l2: "Security Deposits Held", l3: "Deposit In" },
  "Liability > Security Deposits > Security Deposits Refund": { l0: "Liability", l1: "Tenant Deposits", l2: "Security Deposits Held", l3: "Deposit Out" },
  "Transfer Credit Card Payment > Business Card Payments > Business Credit Card Payments": { l0: "Liability", l1: "CC Payment", l2: "Internal Transfer", l3: "BofA Business" },
  "Transfer Credit Card Payment > Credit card payment > Barclay Credit card payment": { l0: "Liability", l1: "CC Payment", l2: "Internal Transfer", l3: "Barclay" },
  "Transfer Credit Card Payment > Credit card payment > Citi Credit card payment": { l0: "Liability", l1: "CC Payment", l2: "Internal Transfer", l3: "Citi" },
  "Transfer Credit Card Payment > Credit card payment > Credit card Payment": { l0: "Liability", l1: "CC Payment", l2: "Internal Transfer", l3: "Credit Card" },
  "Balance Sheet > Transfers > Internal Transfer": { l0: "Asset", l1: "Cash Movement", l2: "Internal Transfer", l3: "Bank Transfer" },
  "Cash & Bank > Transfers > Internal Bank Transfer": { l0: "Asset", l1: "Cash Movement", l2: "Internal Transfer", l3: "Bank Transfer" },
  "Transfer Between Bank Accounts > Transfer > Savings to Checking": { l0: "Asset", l1: "Cash Movement", l2: "Internal Transfer", l3: "Savings Move" },

  // --- BALANCE SHEET: EQUITY ---
  "Owner's Draw > Personal > Charity & Donation": { l0: "Equity", l1: "Owner Distribution", l2: "Owner's Draw", l3: "Donations" },
  "Owner's Draw > Personal Care > Hair & Beauty": { l0: "Equity", l1: "Owner Distribution", l2: "Owner's Draw", l3: "Personal Care" },
  "Owner's Draw > Personal > Digital Purchases": { l0: "Equity", l1: "Owner Distribution", l2: "Owner's Draw", l3: "App Store" },
  "Owner's Draw > Personal > Food & Beverage": { l0: "Equity", l1: "Owner Distribution", l2: "Owner's Draw", l3: "Personal Food" },
  "Owner's Draw > Personal Expenses > Groceries": { l0: "Equity", l1: "Owner Distribution", l2: "Owner's Draw", l3: "Personal Groceries" },
  "Owner's Draw > Personal Spending > Fitness Services": { l0: "Equity", l1: "Owner Distribution", l2: "Owner's Draw", l3: "Fitness" },
  "Personal Expenses > Health & Wellness > Gym Membership": { l0: "Equity", l1: "Owner Distribution", l2: "Owner's Draw", l3: "Gym" },
  "Taxes > Federal Taxes > Income Tax": { l0: "Equity", l1: "Owner Distribution", l2: "Owner's Draw", l3: "Federal Tax" },

  // --- FALLBACKS & GENERAL ---
  "Expense > General > Needs Review": { l0: "Expense", l1: "Property Operations", l2: "Line 19: Other Expenses", l3: "Needs Review" },
  "Operating Expenses > Uncategorized > General Expense": { l0: "Expense", l1: "Property Operations", l2: "Line 19: Other Expenses", l3: "General Expense" },
};

// 3. The Migration Logic
async function runMigration() {
  console.log(`Starting migration for user: ${TARGET_USER_ID}`);
  initializeAdminApp();

  // Get all smart rules for the user
  const rulesCollection = db.collection(`users/${TARGET_USER_ID}/categoryMappings`);
  const rulesSnapshot = await rulesCollection.get();
  
  if (rulesSnapshot.empty) {
    console.log(`No custom rules found for user '${TARGET_USER_ID}'. Nothing to do.`);
    return;
  }
  
  let totalUpdatedCount = 0;
  const batch = db.batch();

  for (const ruleDoc of rulesSnapshot.docs) {
    const rule = ruleDoc.data();

    // Construct the "old" messy key from the existing rule data
    const oldKey = `${rule.primaryCategory || ''} > ${rule.secondaryCategory || ''} > ${rule.subcategory || ''}`.trim();
    
    // Find the corresponding new structure in our mapping table
    const newCategories = mappingTable[oldKey];

    if (newCategories) {
      // If a match is found, update the document in the batch
      batch.update(ruleDoc.ref, {
        categoryHierarchy: newCategories
      });
      totalUpdatedCount++;
    } else {
        // If no match, log a warning so you know which rules couldn't be auto-migrated
        console.warn(`- No mapping found for old rule key: "${oldKey}" (Rule ID: ${ruleDoc.id})`);
    }
  }

  if (totalUpdatedCount > 0) {
    console.log(`\nPreparing to update ${totalUpdatedCount} rules...`);
    await batch.commit();
    console.log(`Successfully updated ${totalUpdatedCount} smart rules for user ${TARGET_USER_ID}.`);
  } else {
    console.log('\nNo rules required an update.');
  }

  console.log('Migration script finished.');
}

runMigration().catch(console.error);
