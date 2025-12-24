
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
const mappingTable: Record<string, {l0: string, l1: string, l2: string, l3: string}> = {
  // --- INCOME & INTEREST ---
  "Interest Income > Bank Interest": { l0: "Income", l1: "Non-Operating", l2: "Bank Interest", l3: "Interest Earned" },
  "Food & Dining > Groceries > Supermarkets & Grocers": { l0: "Expense", l1: "Office Admin", l2: "Line 19: Other Expenses", l3: "Supplies" },

  // --- MORTGAGE & LOANS ---
  "Expenses > Mortgage Interest > Adelyn - Mortgage Interest Paid": { l0: "Expense", l1: "Financing", l2: "Line 12: Mortgage Interest", l3: "Adelyn" },
  "Mortgage & Loans > Principal & Interest > Loan Payment": { l0: "Liability", l1: "Loan Paydown", l2: "Mortgage Principal", l3: "Principal Paydown" },

  // --- TRANSFERS & CREDIT CARDS ---
  "Transfer Credit Card Payment > Business Card Payments > Business Credit Card Payments": { l0: "Liability", l1: "CC Payment", l2: "Internal Transfer", l3: "BofA Business" },
  "Transfer Credit Card Payment > Credit card payment > Barclay Credit card payment": { l0: "Liability", l1: "CC Payment", l2: "Internal Transfer", l3: "Barclay" },
  "Transfer Credit Card Payment > Credit card payment > Citi Credit card payment": { l0: "Liability", l1: "CC Payment", l2: "Internal Transfer", l3: "Citi" },
  "Transfer Credit Card Payment > Credit card payment > Credit card Payment": { l0: "Liability", l1: "CC Payment", l2: "Internal Transfer", l3: "Credit Card" },
  "Transportation > Transfer > Transportation": { l0: "Expense", l1: "Travel", l2: "Line 6: Auto & Travel", l3: "Uber/Travel" },
  "Transportation > Travel Expenses > Transportation": { l0: "Expense", l1: "Travel", l2: "Line 6: Auto & Travel", l3: "Uber/Travel" },

  // --- PROPERTY OPERATIONS & HOA ---
  "Operating Expenses > Hoa > Hoa": { l0: "Expense", l1: "HOA", l2: "Line 19: Other Expenses", l3: "HOA Fees" },
  "Real Estate > Property Operating Expenses > Homeowners Association (HOA) Fees": { l0: "Expense", l1: "HOA", l2: "Line 19: Other Expenses", l3: "HOA Fees" },
  "Real Estate > Property Management > Fees & Services": { l0: "Expense", l1: "Management", l2: "Line 10: Professional Fees", l3: "Property Mgmt" },

  // --- MEALS & ENTERTAINMENT ---
  "Meals & Entertainment > Business Meals > Restaurant/Cafe": { l0: "Expense", l1: "Meals", l2: "Line 19: Other (Meals)", l3: "Cafe/Restaurant" },
  "Operating Expenses > Meals & Entertainment > Business Meals": { l0: "Expense", l1: "Meals", l2: "Line 19: Other (Meals)", l3: "Business Meals" },
  "Dining & Entertainment > Food & Beverages > Fast Food": { l0: "Expense", l1: "Meals", l2: "Line 19: Other (Meals)", l3: "Fast Food" },
  "Owner's Draw > Personal > Food & Entertainment": { l0: "Equity", l1: "Owner Draw", l2: "Personal Spending", l3: "Personal Meals" },

  // --- SOFTWARE & TECHNOLOGY ---
  "Operating Expenses > Services > Subscriptions": { l0: "Expense", l1: "Office Admin", l2: "Line 19: Other Expenses", l3: "Subscriptions" },
  "Technology & Software > Software & Subscriptions > Digital Content & Services": { l0: "Expense", l1: "Technology", l2: "Line 19: Other Expenses", l3: "Digital Services" },
  "Technology > Software & Subscriptions > Cloud Storage & Services": { l0: "Expense", l1: "Technology", l2: "Line 19: Other Expenses", l3: "Cloud Storage" },

  // --- PERSONAL & EQUITY ---
  "Owner's Draw > Personal > Charity & Donation": { l0: "Equity", l1: "Owner Distribution", l2: "Personal Draw", l3: "Donations" },
  "Owner's Draw > Personal Care > Hair & Beauty": { l0: "Equity", l1: "Owner Distribution", l2: "Personal Draw", l3: "Hair & Beauty" },
  "Owner's Draw > Personal > Digital Purchases": { l0: "Equity", l1: "Owner Distribution", l2: "Personal Draw", l3: "App Store" },

  // --- BANK FEES ---
  "Operating Expenses > Bank & Credit Card Fees > Transaction Fee": { l0: "Expense", l1: "Bank Fees", l2: "Line 19: Other Expenses", l3: "Transaction Fee" },

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
  "Operating Expenses > Repairs & Maintenance > Repairs & Maintenance": { l0: "Expense", l1: "Repairs", l2: "Line 14: Repairs", l3: "General" },
  "Operating Expenses > Repairs & Maintenance > Talia - Pool Maintenance": { l0: "Expense", l1: "Repairs", l2: "Line 14: Repairs", l3: "Pool Service" },
  "Operating Expenses > Repairs & Maintenance > Lawn Mowing Services": { l0: "Expense", l1: "Repairs", l2: "Line 14: Repairs", l3: "Lawn Care" },
  "Repairs & Maintenance > Property Repairs > Handyman Services": { l0: "Expense", l1: "Repairs", l2: "Line 14: Repairs", l3: "Handyman" },
  "Repairs & Maintenance > Repairs > Adelyn - Repairs & Maintenance": { l0: "Expense", l1: "Repairs", l2: "Line 14: Repairs", l3: "Adelyn Repair" },
  "Repairs & Maintenance > Repairs > Helmoken - Repairs & Maintenance": { l0: "Expense", l1: "Repairs", l2: "Line 14: Repairs", l3: "Helmoken Repair" },
  "Real Estate Operations > Property Expenses > Repairs & Maintenance": { l0: "Expense", l1: "Repairs", l2: "Line 14: Repairs", l3: "General Maint" },
  "Expenses > Utilities > Talia - Water": { l0: "Expense", l1: "Utilities", l2: "Line 17: Utilities", l3: "Water" },
  "Operating Expenses > Utilities > Electricity": { l0: "Expense", l1: "Utilities", l2: "Line 17: Utilities", l3: "Electricity" },
  "Operating Expenses > Utilities > Phone/Internet": { l0: "Expense", l1: "Utilities", l2: "Line 17: Utilities", l3: "Phone/Internet" },
  "Operating Expenses > Communications & Utilities > Telecommunications": { l0: "Expense", l1: "Utilities", l2: "Line 17: Utilities", l3: "Telecom" },
  "Rent & Utilities > Utilities > Telecommunications/Internet": { l0: "Expense", l1: "Utilities", l2: "Line 17: Utilities", l3: "Internet" },
  "Operating Expenses > Insurance > Property Insurance": { l0: "Expense", l1: "Insurance", l2: "Line 9: Insurance", l3: "Property" },
  "Operating Expenses > Property Insurance > Building Insurance": { l0: "Expense", l1: "Insurance", l2: "Line 9: Insurance", l3: "Building" },
  "Operating Expenses > Taxes > Property Tax": { l0: "Expense", l1: "Taxes", l2: "Line 16: Taxes", l3: "Property Tax" },
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
  "Liability > Deposit > Security Deposit Received": { l0: "Liability", l1: "Tenant Deposits", l2: "Security Deposits Held", l3: "Deposit In" },
  "Liability > Security Deposits > Security Deposits Refund": { l0: "Liability", l1: "Tenant Deposits", l2: "Security Deposits Held", l3: "Deposit Out" },

  // === LEVEL 0: EQUITY (Personal / Non-Business) ===
  "Owner's Draw > Personal Expense > Groceries": { l0: "Equity", l1: "Owner Distribution", l2: "Personal Draw", l3: "Groceries" },
  "Owner's Draw > Personal Spending > Fitness Services": { l0: "Equity", l1: "Owner Distribution", l2: "Personal Draw", l3: "Fitness" },
  "Personal Expenses > Health & Wellness > Gym Membership": { l0: "Equity", l1: "Owner Distribution", l2: "Personal Draw", l3: "Gym" },
  "Taxes > Federal Taxes > Income Tax": { l0: "Equity", l1: "Owner Distribution", l2: "Personal Draw", l3: "Federal Tax" },

  // === LEVEL 0: ASSET (Internal Movements) ===
  "Balance Sheet > Transfers > Internal Transfer": { l0: "Asset", l1: "Cash Movement", l2: "Internal Transfer", l3: "Bank Transfer" },
  "Transfer Between Bank Accounts > Transfer > Savings to Checking": { l0: "Asset", l1: "Cash Movement", l2: "Internal Transfer", l3: "Savings Move" },

  // --- GAP FILL MAPPINGS ---
  "Expense > Office & Admin > Line 19: Other Expenses": { l0: "Expense", l1: "Office & Admin", l2: "Line 19: Other Expenses", l3: "Supplies" },
  "Operating Expenses > Office Expenses > Supplies": { l0: "Expense", l1: "Office & Admin", l2: "Line 19: Other Expenses", l3: "Supplies" },
  "Expense > Technology > Line 19: Other Expenses": { l0: "Expense", l1: "Technology", l2: "Line 19: Other Expenses", l3: "Software/Digital" },
  "Operating Expenses > Software & Subscriptions > Digital Services": { l0: "Expense", l1: "Technology", l2: "Line 19: Other Expenses", l3: "Digital Services" },
  "Expense > Utilities > Line 17: Utilities": { l0: "Expense", l1: "Utilities", l2: "Line 17: Utilities", l3: "General Utilities" },
  "Expense > Transportation > Line 6: Auto & Travel": { l0: "Expense", l1: "Transportation", l2: "Line 6: Auto & Travel", l3: "Travel" },
  "Operating Expenses > Vehicle & Travel > Travel & Lodging": { l0: "Expense", l1: "Transportation", l2: "Line 6: Auto & Travel", l3: "Travel" },
  "Liability > Credit Card Payment > Internal Transfer": { l0: "Liability", l1: "Credit Card Payment", l2: "Internal Transfer", l3: "CC Payment" },
  "Transfer Credit Card Payment > Credit card payment > Credit card Payment": { l0: "Liability", l1: "Credit Card Payment", l2: "Internal Transfer", l3: "CC Payment" },
  "Cash & Bank > Transfers > Internal Bank Transfer": { l0: "Asset", l1: "Cash Movement", l2: "Internal Transfer", l3: "Bank Transfer" },
  "Operating Expense > Repairs & Maintenance > Property Repair & Maintenance": { l0: "Expense", l1: "Repairs", l2: "Line 14: Repairs", l3: "Property Maint" },
  "Operating Expenses > Property Management > Rent Expense": { l0: "Expense", l1: "Property Operations", l2: "Line 19: Other Expenses", l3: "Rent Expense" },
  "Owner's Draw > Personal > Food & Beverage": { l0: "Equity", l1: "Owner Distribution", l2: "Personal Draw", l3: "Personal Food" },
  "Owner's Draw > Personal Expenses > Meals": { l0: "Equity", l1: "Owner Distribution", l2: "Personal Draw", l3: "Personal Meals" },
  "Owner's Draw > Personal > Software/Subscription": { l0: "Equity", l1: "Owner Distribution", l2: "Personal Draw", l3: "Personal Software" },
  "Expense > General > Needs Review": { l0: "Expense", l1: "General", l2: "Needs Review", l3: "Review Required" },
  "Operating Expenses > Uncategorized > General Expense": { l0: "Expense", l1: "General", l2: "Needs Review", l3: "General Expense" },
  
  // --- Self-Referential Mappings (Prevents errors for already migrated docs) ---
  "Expense > Insurance > Line 9: Insurance": { l0: "Expense", l1: "Insurance", l2: "Line 9: Insurance", l3: "Property Insurance" },
  "Expense > Repairs > Line 14: Repairs": { l0: "Expense", l1: "Repairs", l2: "Line 14: Repairs", l3: "Maintenance" },
  "Expense > Professional > Line 10: Legal/Professional": { l0: "Expense", l1: "Professional", l2: "Line 10: Legal/Professional", l3: "Consulting" },
  "Expense > Taxes > Line 16: Taxes": { l0: "Expense", l1: "Taxes", l2: "Line 16: Taxes", l3: "Property Tax" },
  "Liability > Debt Service > Loan Paydown": { l0: "Liability", l1: "Debt Service", l2: "Loan Principal", l3: "SBA/Mortgage" },
  "Liability > Debt Service > Vehicle Loan": { l0: "Liability", l1: "Debt Service", l2: "Vehicle Loan", l3: "Auto Payment" },
  "Liability > Debt Service > Mortgage Principal": { l0: "Liability", l1: "Debt Service", l2: "Mortgage Principal", l3: "Rosegate/Flagstar" },
  "Liability > Tenant Deposits > Security Deposits Held": { l0: "Liability", l1: "Security Deposits", l2: "Tenant Deposits Held", l3: "Security Deposit" },
  "Income > Rental Income > Line 3: Rents Received": { l0: "Income", l1: "Rental Income", l2: "Line 3: Rents Received", l3: "Rental Income" },
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

      // --- IMPROVED LOGIC: CHECK IF ALREADY MIGRATED ---
      // If the 'details' field exists, we assume it's in the new format and skip it.
      if (tx.details) {
          return;
      }
      
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
          console.warn(`- No mapping found for old key: "${oldKey}" (Transaction ID: ${doc.id})`);
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

    