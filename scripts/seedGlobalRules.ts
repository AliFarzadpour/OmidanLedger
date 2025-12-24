

// scripts/seedGlobalRules.ts
import * as admin from 'firebase-admin';
import * as path from 'path';

// 1. Initialize Admin SDK (Run this locally with service account credentials)
// Use path.join to create a reliable, absolute path to the service account key
const serviceAccountPath = path.join(process.cwd(), 'service-account.json');
const serviceAccount = require(serviceAccountPath); 

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 2. Define the Master List (The "Universal Truths") - Now aligned with 4-level schema
const globalRules = [
  // --- RETAIL & SUPPLIES (Big Box) ---
  { keywords: ['HOMEDEPOT', 'HOME DEPOT', 'LOWES', 'ACE HARDWARE', 'SHERWIN-WILLIAMS', 'IKEA'], categoryHierarchy: { l0: 'Expense', l1: 'Property Operations', l2: 'Line 14: Repairs', l3: 'Maintenance Supplies' } },
  { keywords: ['WALMART', 'TARGET', 'COSTCO', 'SAMS CLUB', 'BEST BUY'], categoryHierarchy: { l0: 'Expense', l1: 'Property Operations', l2: 'Line 19: Other Expenses', l3: 'General Supplies' } },
  { keywords: ['OFFICE DEPOT', 'STAPLES', 'OFFICE MAX'], categoryHierarchy: { l0: 'Expense', l1: 'Office Admin', l2: 'Line 15: Supplies', l3: 'Office Supplies' } },
  { keywords: ['AMAZON', 'AMZN', 'AMAZON MKTPL'], categoryHierarchy: { l0: 'Expense', l1: 'Property Operations', l2: 'Line 19: Other Expenses', l3: 'Supplies' } },

  // --- UTILITIES ---
  { keywords: ['VERIZON', 'AT&T', 'T-MOBILE', 'SPRINT', 'COMCAST', 'SPECTRUM', 'COX', 'FRONTIER'], categoryHierarchy: { l0: 'Expense', l1: 'Rent & Utilities', l2: 'Line 17: Utilities', l3: 'Telephone & Internet' } },
  { keywords: ['PG&E', 'CON EDISON', 'ATMOS', 'SOCALGAS', 'GEORGIA POWER'], categoryHierarchy: { l0: 'Expense', l1: 'Rent & Utilities', l2: 'Line 17: Utilities', l3: 'Gas & Electric' } },
  { keywords: ['CITY OF', 'LAGUNA BEACH UTILITIES', 'LA DWP'], categoryHierarchy: { l0: 'Expense', l1: 'Rent & Utilities', l2: 'Line 17: Utilities', l3: 'Water & Sewer' } },

  // --- GOVERNMENT & TAXES ---
  { keywords: ['IRS', 'US TREASURY'], categoryHierarchy: { l0: 'Equity', l1: 'Personal', l2: 'Owner\'s Draw', l3: 'Federal Taxes' } },
  { keywords: ['DMV', 'DEPT OF MOTOR VEHICLES'], categoryHierarchy: { l0: 'Expense', l1: 'Taxes & Licenses', l2: 'Line 16: Taxes', l3: 'Vehicle Registration' } },
  { keywords: ['USPS', 'POST OFFICE'], categoryHierarchy: { l0: 'Expense', l1: 'Office Admin', l2: 'Line 19: Other Expenses', l3: 'Postage & Shipping' } },
  
  // --- INSURANCE ---
  { keywords: ['GEICO', 'STATE FARM', 'PROGRESSIVE', 'ALLSTATE', 'LIBERTY MUTUAL'], categoryHierarchy: { l0: 'Expense', l1: 'Insurance', l2: 'Line 9: Insurance', l3: 'Property & Casualty Insurance' } },

  // --- LEGAL & PROFESSIONAL ---
  { keywords: ['LEGALZOOM', 'EVICTION', 'NOTARY', 'DOCUSIGN'], categoryHierarchy: { l0: 'Expense', l1: 'Legal & Professional', l2: 'Line 10: Legal and other professional fees', l3: 'Legal & Filing Fees' } },

  // --- MARKETING ---
  { keywords: ['FACEBOOK ADS', 'GOOGLE ADS', 'YELP ADS', 'ZILLOW', 'APARTMENTS.COM', 'ADS957'], categoryHierarchy: { l0: 'Expense', l1: 'Marketing', l2: 'Line 5: Advertising', l3: 'Digital Advertising' } },

  // --- SHIPPING ---
  { keywords: ['FEDEX', 'UPS', 'DHL'], categoryHierarchy: { l0: 'Expense', l1: 'Office Admin', l2: 'Line 19: Other Expenses', l3: 'Shipping' } },

  // --- HEALTHCARE ---
  { keywords: ['KAISER', 'CVS', 'WALGREENS', 'UNITEDHEALTH'], categoryHierarchy: { l0: 'Equity', l1: 'Personal', l2: 'Owner\'s Draw', l3: 'Healthcare' } },
  
  // --- DINING (Default to Personal) ---
  { keywords: ['STARBUCKS', 'MCDONALD', 'CHICK-FIL-A', 'SUBWAY', 'SHAKE SHACK', 'CHIPOTLE', 'PANERA', 'URTH CAFFE'], categoryHierarchy: { l0: 'Equity', l1: 'Personal', l2: 'Owner\'s Draw', l3: 'Dining' } },
  { keywords: ['MAGGIANOS'], categoryHierarchy: { l0: 'Equity', l1: 'Personal', l2: 'Owner\'s Draw', l3: 'Restaurant' } },
  
  // --- TRAVEL ---
  { keywords: ['UBER', 'LYFT'], categoryHierarchy: { l0: 'Expense', l1: 'Vehicle & Travel', l2: 'Line 6: Auto & Travel', l3: 'Rideshare' } },
  { keywords: ['DELTA', 'AMERICAN AIR', 'UNITED AIR', 'SOUTHWEST'], categoryHierarchy: { l0: 'Expense', l1: 'Vehicle & Travel', l2: 'Line 6: Auto & Travel', l3: 'Airfare' } },
  { keywords: ['MARRIOTT', 'HILTON', 'HYATT', 'AIRBNB'], categoryHierarchy: { l0: 'Expense', l1: 'Vehicle & Travel', l2: 'Line 6: Auto & Travel', l3: 'Lodging' } },
  { keywords: ['HERTZ', 'AVIS', 'ENTERPRISE'], categoryHierarchy: { l0: 'Expense', l1: 'Vehicle & Travel', l2: 'Line 6: Auto & Travel', l3: 'Rental Car' } },
  { keywords: ['NTTA'], categoryHierarchy: { l0: 'Expense', l1: 'Vehicle & Travel', l2: 'Line 6: Auto & Travel', l3: 'Tolls' } },

  // --- PERSONAL RETAIL ---
  { keywords: ['MACYS', 'NORDSTROM', 'DILLARD', 'TJ MAXX', 'MARSHALLS', 'ROSS', 'H&M', 'ZARA', 'NIKE', 'ADIDAS', 'LULULEMON', 'SEPHORA', 'ULTA', 'CALVIN KLEIN'], categoryHierarchy: { l0: 'Equity', l1: 'Personal', l2: 'Owner\'s Draw', l3: 'Apparel & Retail' } },

  // --- SOFTWARE ---
  { keywords: ['OPENAI', 'CHATGPT', 'DIGITALOCEAN', 'GODADDY', 'ADOBE', 'INTUIT', 'MICROSOFT', 'GSUITE', 'AWS'], categoryHierarchy: { l0: 'Expense', l1: 'Office Admin', l2: 'Line 19: Other Expenses', l3: 'Software & Subscriptions' } },
];

async function seedDatabase() {
  const batch = db.batch();
  
  console.log("Starting seed with 4-level tax-aligned categories...");

  for (const group of globalRules) {
    for (const keyword of group.keywords) {
        // Use normalized, all-caps keyword as the Document ID for fast, case-insensitive lookups
        const docId = keyword.toUpperCase().replace(/[^A-Z0-9]/g, '');
        const docRef = db.collection('globalVendorMap').doc(docId);
        
        batch.set(docRef, {
            originalKeyword: keyword,
            categoryHierarchy: group.categoryHierarchy,
            source: 'global_seed_v4'
        }, { merge: true });
    }
  }

  await batch.commit();
  console.log("Database seeded successfully with updated 4-level taxonomy!");
}

seedDatabase().catch(console.error);
