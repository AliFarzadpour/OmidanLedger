
// scripts/migrate-account-data.ts
import * as admin from 'firebase-admin';
import * as path from 'path';

// --- CONFIGURATION ---
const TARGET_USER_ID = 'QsMUGG2ldOa0bpRHJCnVP3pKyIv1';

// 1. Initialize Admin SDK
const serviceAccountPath = path.join(process.cwd(), 'service-account.json');
const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();


// 2. The Master Mapping Table provided by the user
const mappingTable: Record<string, { l0: string; l1: string; l2: string; l3: string }> = {
  // === LEVEL 0: INCOME (Schedule E, Line 3) ===
  "Income > Rental Income > Adelyn - Rents Received": { l0: "Income", l1: "Rental Income", l2: "Line 3: Rents Received", l3: "Adelyn" },
  "Income > Rental Income > Adelyn Rental Income": { l0: "Income", l1: "Rental Income", l2: "Line 3: Rents Received", l3: "Adelyn" },
  "Income > Rental Income > Dallas Rental Income": { l0: "Income", l1: "Rental Income", l2: "Line 3: Rents Received", l3: "Dallas" },
  "Income > Rental Income > Helmoken - Rents Received": { l0: "Income", l1: "Rental Income", l2: "Line 3: Rents Received", l3: "Helmoken" },
  "Income > Rental Income > Lewisville Rent Income": { l0: "Income", l1: "Rental Income", l2: "Line 3: Rents Received", l3: "Lewisville" },
  "Income > Rental Income > PeachBush - Rents Received": { l0: "Income", l1: "Rental Income", l2: "Line 3: Rents Received", l3: "PeachBush" },
  "Income > Rental Income > Plano Office - Rents Received": { l0: "Income", l1: "Rental Income", l2: "Line 3: Rents Received", l3: "Plano Office" },
  "Income > Rental Income > Richardson Rent Income": { l0: "Income", l1: "Rental Income", l2: "Line 3: Rents Received", l3: "Richardson" },
  "Income > Operating Income > Talia Rental Income": { l0: "Income", l1: "Rental Income", l2: "Line 3: Rents Received", l3: "Talia" },
  "Income > Interest Income > Bank Interest": { l0: "Income", l1: "Non-Operating", l2: "Bank Interest", l3: "Interest Earned" },
  "Income > Refund > Refund": { l0: "Income", l1: "Adjustments", l2: "Line 3: Rents Received", l3: "Refund" },
  "Refund > Income Rufund > Income Refund": { l0: "Income", l1: "Adjustments", l2: "Line 3: Rents Received", l3: "Income Refund" },
  "Office & Administrative > Software & Subscriptions > Account Verification": { l0: "Income", l1: "Adjustments", l2: "Line 3: Rents Received", l3: "Verification Credit" },

  // === LEVEL 0: EXPENSE (Tax Deductible) ===
  // Repairs (Line 14)
  "Operating Expenses > Repairs & Maintenance > Repairs & Maintenance": { l0: "Expense", l1: "Repairs", l2: "Line 14: Repairs", l3: "General" },
  "Operating Expenses > Repairs & Maintenance > Talia - Pool Maintenance": { l0: "Expense", l1: "Repairs", l2: "Line 14: Repairs", l3: "Pool Service" },
  "Operating Expenses > Repairs & Maintenance > Lawn Mowing Services": { l0: "Expense", l1: "Repairs", l2: "Line 14: Repairs", l3: "Lawn Care" },
  "Repairs & Maintenance > Property Repairs > Handyman Services": { l0: "Expense", l1: "Repairs", l2: "Line 14: Repairs", l3: "Handyman" },
  "Repairs & Maintenance > Repairs > Adelyn - Repairs & Maintenance": { l0: "Expense", l1: "Repairs", l2: "Line 14: Repairs", l3: "Adelyn Repair" },
  "Repairs & Maintenance > Repairs > Helmoken - Repairs & Maintenance": { l0: "Expense", l1: "Repairs", l2: "Line 14: Repairs", l3: "Helmoken Repair" },
  "Real Estate Operations > Property Expenses > Repairs & Maintenance": { l0: "Expense", l1: "Repairs", l2: "Line 14: Repairs", l3: "General Maint" },
  
  // Utilities (Line 17)
  "Expenses > Utilities > Talia - Water": { l0: "Expense", l1: "Utilities", l2: "Line 17: Utilities", l3: "Water" },
  "Operating Expenses > Utilities > Electricity": { l0: "Expense", l1: "Utilities", l2: "Line 17: Utilities", l3: "Electricity" },
  "Operating Expenses > Utilities > Phone/Internet": { l0: "Expense", l1: "Utilities", l2: "Line 17: Utilities", l3: "Phone/Internet" },
  "Operating Expenses > Communications & Utilities > Telecommunications": { l0: "Expense", l1: "Utilities", l2: "Line 17: Utilities", l3: "Telecom" },
  "Rent & Utilities > Utilities > Telecommunications/Internet": { l0: "Expense", l1: "Utilities", l2: "Line 17: Utilities", l3: "Internet" },

  // Insurance & Taxes (Line 9 & 16)
  "Operating Expenses > Insurance > Property Insurance": { l0: "Expense", l1: "Insurance", l2: "Line 9: Insurance", l3: "Property" },
  "Operating Expenses > Property Insurance > Building Insurance": { l0: "Expense", l1: "Insurance", l2: "Line 9: Insurance", l3: "Building" },
  "Operating Expenses > Taxes > Property Tax": { l0: "Expense", l1: "Taxes", l2: "Line 16: Taxes", l3: "Property Tax" },

  // Professional & Other (Line 10 & 19)
  "Professional Fees > Financial Services > Accounting & Tax preparation": { l0: "Expense", l1: "Professional", l2: "Line 10: Legal/Professional", l3: "Accounting" },
  "Professional Services > Accounting & Tax Services > Tax Consulting": { l0: "Expense", l1: "Professional", l2: "Line 10: Legal/Professional", l3: "Tax Prep" },
  "Operating Expenses > Cosoltation > Contractors and consultation": { l0: "Expense", l1: "Professional", l2: "Line 10: Legal/Professional", l3: "Contractors" },
  "Operating Expense > Hoa > Hoa": { l0: "Expense", l1: "Operations", l2: "Line 19: Other (HOA)", l3: "HOA" },
  "Operating Expense > Property Management > HOA Fees": { l0: "Expense", l1: "Operations", l2: "Line 19: Other (HOA)", l3: "HOA" },
  "Operating Expenses > Office Expenses > Office Supplies": { l0: "Expense", l1: "Office", l2: "Line 19: Other Expenses", l3: "Supplies" },
  "Office Expenses > Supplies > Groceries/Beverages": { l0: "Expense", l1: "Office", l2: "Line 19: Other Expenses", l3: "Office Food" },
  "Operating Expenses > Software & Subscriptions > Software & Subscriptions": { l0: "Expense", l1: "Tech", l2: "Line 19: Other Expenses", l3: "Software" },
  "Operating Expenses > Meals & Entertainment > Food & Beverage": { l0: "Expense", l1: "Meals", l2: "Line 19: Other (Meals)", l3: "Business Meals" },
  "Transportation > Vehicle Expenses > Tolls": { l0: "Expense", l1: "Travel", l2: "Line 6: Auto/Travel", l3: "Tolls" },

  // === LEVEL 0: LIABILITY (Balance Sheet) ===
  "Debt Service > Loan Payments > SBA EIDL Loan Payment": { l0: "Liability", l1: "Debt Service", l2: "Loan Paydown", l3: "SBA EIDL" },
  "Transportation > Vehicle Expenses > Car & Truck": { l0: "Liability", l1: "Debt Service", l2: "Vehicle Loan", l3: "Auto Payment" },
  "Mortgage & Loans > Principal & Interest > Loan Payment": { l0: "Liability", l1: "Debt Service", l2: "Mortgage Principal", l3: "Loan Pay" },
  "Liability > Deposit > Security Deposit Received": { l0: "Liability", l1: "Tenant Deposits", l2: "Security Deposits Held", l3: "Deposit In" },
  "Liability > Security Deposits > Security Deposits Refund": { l0: "Liability", l1: "Tenant Deposits", l2: "Security Deposits Held", l3: "Deposit Out" },

  // === LEVEL 0: EQUITY (Personal / Non-Business) ===
  "Owner's Draw > Personal Expense > Groceries": { l0: "Equity", l1: "Owner Distribution", l2: "Personal Draw", l3: "Groceries" },
  "Owner's Draw > Personal Spending > Fitness Services": { l0: "Equity", l1: "Owner Distribution", l2: "Personal Draw", l3: "Fitness" },
  "Personal Expenses > Health & Wellness > Gym Membership": { l0: "Equity", l1: "Owner Distribution", l2: "Personal Draw", l3: "Gym" },
  "Taxes > Federal Taxes > Income Tax": { l0: "Equity", l1: "Owner Distribution", l2: "Personal Draw", l3: "Federal Tax" },

  // === LEVEL 0: ASSET (Internal Movements) ===
  "Balance Sheet > Transfers > Internal Transfer": { l0: "Asset", l1: "Cash Movement", l2: "Internal Transfer", l3: "Bank Transfer" },
  "Transfer Between Bank Accounts > Transfer > Savings to Checking": { l0: "Asset", l1: "Cash Movement", l2: "Internal Transfer", l3: "Savings Move" }
};

// 3. The Migration Logic
async function runMigration() {
  console.log(`Starting migration for user: ${TARGET_USER_ID}`);

  // Get all bank accounts for the user
  const accountsCollection = db.collection(`users/${TARGET_USER_ID}/bankAccounts`);
  const accountsSnapshot = await accountsCollection.get();
  
  if (accountsSnapshot.empty) {
    console.error(`Error: No bank accounts found for user '${TARGET_USER_ID}'.`);
    return;
  }
  
  let totalUpdatedCount = 0;

  for (const accountDoc of accountsSnapshot.docs) {
    console.log(`\nProcessing account: ${accountDoc.id} (${accountDoc.data().accountName})`);

    // Get all transactions for that account
    const transactionsRef = accountDoc.ref.collection('transactions');
    const transactionsSnap = await transactionsRef.get();
    
    if (transactionsSnap.empty) {
      console.log(' -> No transactions found in this account. Skipping.');
      continue;
    }

    const batch = db.batch();
    let updatedInThisAccount = 0;

    transactionsSnap.forEach(doc => {
      const tx = doc.data();
      
      // Construct the "old" messy key from the existing data and trim it
      const oldKey = `${tx.primaryCategory} > ${tx.secondaryCategory} > ${tx.subcategory}`.trim();

      // Look it up in the mapping table
      const newCategories = mappingTable[oldKey];

      if (newCategories) {
        // If a match is found, update the transaction document
        batch.update(doc.ref, {
          primaryCategory: newCategories.l0,   // Level 0
          secondaryCategory: newCategories.l1, // Level 1
          subcategory: newCategories.l2,       // Level 2
          details: newCategories.l3            // Level 3
        });
        updatedInThisAccount++;
      } else {
          console.warn(` - No mapping found for old key: "${oldKey}" (Transaction ID: ${doc.id})`);
      }
    });

    if (updatedInThisAccount > 0) {
      console.log(` -> Preparing to update ${updatedInThisAccount} transactions in this account...`);
      await batch.commit();
      console.log(` -> Successfully updated ${updatedInThisAccount} transactions.`);
      totalUpdatedCount += updatedInThisAccount;
    } else {
      console.log(' -> No matching transactions found to update in this account.');
    }
  }

  console.log(`\nMigration complete! Successfully updated a total of ${totalUpdatedCount} transactions across all accounts.`);
}

runMigration().catch(console.error);
