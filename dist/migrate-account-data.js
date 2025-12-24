"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
// scripts/migrate-account-data.ts
const admin = __importStar(require("firebase-admin"));
const path = __importStar(require("path"));
// --- CONFIGURATION ---
const TARGET_USER_ID = 'QsMUGG2ldOa0bpRHJCnVP3pKyIv1';
const TARGET_ACCOUNT_SUFFIX = '4748';
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
const mappingTable = {
    // --- INCOME (Major Type: Income, Schedule E Line 3) ---
    "Income > Operating Income > Talia Rental Income": { l0: "Income", l1: "Rental Income", l2: "Line 3: Rents Received", l3: "Talia" },
    "Income > Rental Income > Adelyn - Rents Received": { l0: "Income", l1: "Rental Income", l2: "Line 3: Rents Received", l3: "Adelyn" },
    "Income > Rental Income > Dallas Rental Income": { l0: "Income", l1: "Rental Income", l2: "Line 3: Rents Received", l3: "Dallas" },
    "Income > Rental Income > Plano Office - Rents Received": { l0: "Income", l1: "Rental Income", l2: "Line 3: Rents Received", l3: "Plano Office" },
    // --- REPAIRS & MAINTENANCE (Major Type: Expense, Schedule E Line 14) ---
    "Operating Expense > Repairs & Maintenance > Property Repair & Maintenance": { l0: "Expense", l1: "Repairs & Maintenance", l2: "Line 14: Repairs", l3: "General" },
    "Repairs & Maintenance > Property Repairs > Handyman Services": { l0: "Expense", l1: "Repairs & Maintenance", l2: "Line 14: Repairs", l3: "Handyman" },
    "Operating Expenses > Repairs & Maintenance > Talia - Pool Maintenance": { l0: "Expense", l1: "Repairs & Maintenance", l2: "Line 14: Repairs", l3: "Pool Maintenance" },
    "Operating Expenses > Repairs & Maintenance > Lawn Mowing Services": { l0: "Expense", l1: "Repairs & Maintenance", l2: "Line 14: Repairs", l3: "Lawn Care" },
    // --- UTILITIES (Major Type: Expense, Schedule E Line 17) ---
    "Expenses > Utilities > Talia - Water": { l0: "Expense", l1: "Utilities", l2: "Line 17: Utilities", l3: "Water" },
    "Operating Expenses > Utilities > Electricity": { l0: "Expense", l1: "Utilities", l2: "Line 17: Utilities", l3: "Electricity" },
    "Rent & Utilities > Utilities > Telecommunications/Internet": { l0: "Expense", l1: "Utilities", l2: "Line 17: Utilities", l3: "Internet" },
    "Operating Expenses > Utilities > Phone/Internet": { l0: "Expense", l1: "Utilities", l2: "Line 17: Utilities", l3: "Phone & Internet" },
    // --- MORTGAGE & LOANS (Major Type: Expense, Schedule E Line 12) ---
    "Expenses > Mortgage Interest > Adelyn - Mortgage Interest Paid": { l0: "Expense", l1: "Financing", l2: "Line 12: Mortgage Interest", l3: "Mortgage" },
    "Debt Service > Loan Payments > SBA EIDL Loan Payment": { l0: "Liability", l1: "Loan Paydown", l2: "Non-Deductible Principal", l3: "SBA EIDL" },
    // --- PROFESSIONAL FEES (Major Type: Expense, Schedule E Line 10) ---
    "Professional Fees > Financial Services > Accounting & Tax preparation": { l0: "Expense", l1: "Professional Fees", l2: "Line 10: Legal & Professional", l3: "Accounting" },
    "Professional Services > Accounting & Tax Services > Tax Consulting": { l0: "Expense", l1: "Professional Fees", l2: "Line 10: Legal & Professional", l3: "Tax Prep" },
    // --- OWNER'S EQUITY (Major Type: Equity) ---
    "Owner's Draw > Personal Expense > Groceries": { l0: "Equity", l1: "Owner Distribution", l2: "Personal Draw", l3: "Groceries" },
    "Owner's Draw > Personal > Charity & Donation": { l0: "Equity", l1: "Owner Distribution", l2: "Personal Draw", l3: "Donation" },
    // --- TRANSFERS (Major Type: Asset - Movement Only) ---
    "Balance Sheet > Transfers > Internal Transfer": { l0: "Asset", l1: "Cash Movement", l2: "Internal Transfer", l3: "Bank Transfer" },
    "Transfer Credit Card Payment > Credit card payment > Barclay Credit card payment": { l0: "Liability", l1: "Credit Card Payment", l2: "Debt Paydown", l3: "Barclay" },
    "Transfer to Credit Card > Credit card payment recived > Credit card Payment": { l0: "Liability", l1: "Credit Card Payment", l2: "Internal Transfer", l3: "Credit Card Paydown" },
    // --- TAXES (Major Type: Expense, Schedule E Line 16) ---
    "Operating Expenses > Taxes > Property Tax": { l0: "Expense", l1: "Taxes", l2: "Line 16: Taxes", l3: "Property Tax" },
    "Taxes > Federal Taxes > Income Tax": { l0: "Equity", l1: "Personal Tax", l2: "Non-Deductible", l3: "Income Tax" },
    // --- OFFICE EXPENSES (Line 19) ---
    "Operating Expenses > Office Expenses > Office Supplies": { l0: "Expense", l1: "Office & Admin", l2: "Line 19: Other Expenses", l3: "Office Supplies" },
    // --- SOFTWARE (Line 19 or Line 10) ---
    "Operating Expenses > Software & Subscriptions > Software & Subscriptions": { l0: "Expense", l1: "Technology", l2: "Line 19: Other Expenses", l3: "Software" },
    // --- TRANSPORTATION / TOLLS (Line 6) ---
    "Transportation > Vehicle Expenses > Tolls": { l0: "Expense", l1: "Transportation", l2: "Line 6: Auto & Travel", l3: "Tolls" },
    "Transportation > Tolls > Road & Bridge Tolls": { l0: "Expense", l1: "Transportation", l2: "Line 6: Auto & Travel", l3: "Tolls" },
    "Transportation > Auto > Tolls": { l0: "Expense", l1: "Transportation", l2: "Line 6: Auto & Travel", l3: "Tolls" },
    // --- UNCATEGORIZED ---
    "Operating Expenses > Uncategorized > General Expense": { l0: "Expense", l1: "General", l2: "Needs Review", l3: "Uncategorized" }
};
// 3. The Migration Logic
async function runMigration() {
    console.log('Starting migration...');
    // Find the bank account
    const accountsCollection = db.collection(`users/${TARGET_USER_ID}/bankAccounts`);
    const snapshot = await accountsCollection.get();
    const targetAccount = snapshot.docs.find(doc => {
        const data = doc.data();
        const numberToCheck = data.accountNumber || data.plaidAccountId || data.mask;
        return numberToCheck && numberToCheck.endsWith(TARGET_ACCOUNT_SUFFIX);
    });
    if (!targetAccount) {
        console.error(`Error: Could not find a bank account ending in '${TARGET_ACCOUNT_SUFFIX}' for user '${TARGET_USER_ID}'.`);
        return;
    }
    console.log(`Found target account: ${targetAccount.id} (${targetAccount.data().accountName})`);
    // Get all transactions for that account
    const transactionsRef = targetAccount.ref.collection('transactions');
    const transactionsSnap = await transactionsRef.get();
    if (transactionsSnap.empty) {
        console.log('No transactions found in this account. Nothing to migrate.');
        return;
    }
    // Create a batch write
    const batch = db.batch();
    let updatedCount = 0;
    transactionsSnap.forEach(doc => {
        const tx = doc.data();
        // Construct the "old" messy key from the existing data
        const oldKey = `${tx.primaryCategory} > ${tx.secondaryCategory} > ${tx.subcategory}`.trim();
        // Look it up in the mapping table
        const newCategories = mappingTable[oldKey];
        if (newCategories) {
            // If a match is found, update the transaction document
            batch.update(doc.ref, {
                primaryCategory: newCategories.l0, // Level 0
                secondaryCategory: newCategories.l1, // Level 1
                subcategory: newCategories.l2, // Level 2
                details: newCategories.l3 // Level 3
            });
            updatedCount++;
        }
        else {
            console.warn(`- No mapping found for old key: "${oldKey}" (Transaction ID: ${doc.id})`);
        }
    });
    if (updatedCount === 0) {
        console.log('No transactions matched the mapping table. No updates were made.');
        return;
    }
    console.log(`Preparing to update ${updatedCount} transactions...`);
    // Commit the batch
    await batch.commit();
    console.log(`Migration complete! Successfully updated ${updatedCount} transactions.`);
}
runMigration().catch(console.error);
