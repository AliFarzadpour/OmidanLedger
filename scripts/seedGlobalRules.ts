

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
  // --- DINING & MEALS ---
  { keywords: ['STARBUCKS', 'MCDONALD', 'CHICK-FIL-A', 'IN-N-OUT', 'DUNKIN', 'CHUY', 'CHEESECAKE', 'BRAUMS', 'ROADHOUSE', 'WHATABURGER', 'PANERA', 'DENNY', 'WENDY', 'BURGER KING', 'TACO BELL', 'TB REST', 'TB RET', 'SHAKE SHACK', 'PIZZA GUYS', 'THE COFFEE COMPANY'], 
    categoryHierarchy: { l0: 'Expense', l1: 'Meals', l2: 'Line 19: Other', l3: 'Business Meals' } },
  { keywords: ['MAGGIANOS'],
    categoryHierarchy: { l0: 'Expense', l1: 'Meals', l2: 'Line 19: Other', l3: 'Business Dining' } },

  // --- PERSONAL / RETAIL ---
  { keywords: ['TJ MAXX', 'MACY', 'NORDSTROM', 'DILLARD', 'MARSHALLS', 'ROSS', 'H&M', 'ZARA', 'UNIQLO', 'SKECHERS', 'NIKE', 'ADIDAS', 'LULULEMON', 'SEPHORA', 'ULTA', 'CALVIN', 'NAUTICA', 'COLUMBIA', 'BEYOND CLIPS'], 
    categoryHierarchy: { l0: 'Equity', l1: 'Owner Distribution', l2: 'Non-Deductible', l3: 'Personal Apparel' } },
  { keywords: ['URTH CAFFE', 'SAFFRON & ROSE ICE CRE'],
    categoryHierarchy: { l0: 'Equity', l1: 'Owner Distribution', l2: 'Non-Deductible', l3: 'Personal Food' } },
  { keywords: ['CA PARKS YODEL PARK', 'STONEBRIAR'], // Stonebriar is a mall
    categoryHierarchy: { l0: 'Equity', l1: 'Owner Distribution', l2: 'Non-Deductible', l3: 'Personal Entertainment' } },
  
  // --- OFFICE, REPAIRS, & SUPPLIES ---
  { keywords: ['OFFICE DEPOT', 'STAPLES'], 
    categoryHierarchy: { l0: 'Expense', l1: 'Office Admin', l2: 'Line 15: Supplies', l3: 'Office Supplies' } },
  { keywords: ['HOME DEPOT', 'LOWES', 'MICRO CENTER'], 
    categoryHierarchy: { l0: 'Expense', l1: 'Repairs', l2: 'Line 14: Repairs', l3: 'Materials & Supplies' } },
  { keywords: ['AMAZON', 'WALMART', 'TARGET', 'COSTCO', 'SAMS CLUB'], 
    categoryHierarchy: { l0: 'Expense', l1: 'Office Admin', l2: 'Line 15: Supplies', l3: 'General Supplies' } },

  // --- SOFTWARE & SUBSCRIPTIONS ---
  { keywords: ['OPENAI', 'CHATGPT', 'DIGITALOCEAN', 'GODADDY', 'NAME-CHEAP', 'ADOBE', 'INTUIT', 'GOOGLE', 'MICROSOFT', 'VPN', 'ESIGN', 'TRADE IDEAS', 'GSUITE', 'AWS', 'CLOUD', 'INVIDEO', 'ADROLL', 'AMAZON PRIME'], 
    categoryHierarchy: { l0: 'Expense', l1: 'Office Admin', l2: 'Line 19: Other', l3: 'Software & Subscriptions' } },

  // --- TRAVEL & TRANSPORTATION ---
  { keywords: ['TRIP.COM', 'EXPEDIA', 'KLOOK', 'AGODA', 'AIRBNB', 'HOTEL', 'INN', 'LODGE', 'RESORT', 'HILTON', 'SHERATON', 'MARRIOTT', 'HYATT', 'WESTIN', 'FAIRMONT', 'SIXT', 'HERTZ', 'AVIS', 'BUDGET', 'ENTERPRISE', 'TRAVELOCITY', 'WISECARS'], 
    categoryHierarchy: { l0: 'Expense', l1: 'Travel', l2: 'Line 6: Auto & Travel', l3: 'Travel & Lodging' } },
  { keywords: ['AMERICAN AIR', 'DELTA', 'UNITED', 'SOUTHWEST', 'FRONTIER A', 'FRONTIER K', 'AMERICAN 00122'],
    categoryHierarchy: { l0: 'Expense', l1: 'Travel', l2: 'Line 6: Auto & Travel', l3: 'Airfare' } },
  { keywords: ['NTTA'],
    categoryHierarchy: { l0: 'Expense', l1: 'Travel', l2: 'Line 6: Auto & Travel', l3: 'Tolls'}},
  { keywords: ['SAN CLEMENTE PARKING'],
    categoryHierarchy: { l0: 'Expense', l1: 'Travel', l2: 'Line 6: Auto & Travel', l3: 'Parking'}},

  // --- UTILITIES & GOVERNMENT ---
  { keywords: ['CITY OF', 'TOWN OF', 'WATER', 'ELECTRIC', 'POWER', 'ATMOS', 'WASTE', 'TRASH', 'FRONTIER', 'VERIZON', 'AT&T', 'T-MOBILE'], 
    categoryHierarchy: { l0: 'Expense', l1: 'Utilities', l2: 'Line 17: Utilities', l3: 'General Utilities' } },
  { keywords: ['CITITURF', 'CITY OF LAGUNA BEACH'],
    categoryHierarchy: { l0: 'Expense', l1: 'Taxes', l2: 'Line 16: Taxes', l3: 'Municipal Fees' } },
  
  // --- MARKETING ---
  { keywords: ['ADS9577534252'], // Example of an opaque ad network ID
    categoryHierarchy: { l0: 'Expense', l1: 'Marketing', l2: 'Line 5: Advertising', l3: 'Digital Ads' } },

  // --- FUEL ---
  { keywords: ['SHELL', 'EXXON', 'CHEVRON', 'QT', 'QUIKTRIP', '7-ELEVEN', 'RACETRAC', 'CIRCLE K', 'PHILLIPS 66', 'CONOCO', 'CENEX'], 
    categoryHierarchy: { l0: 'Expense', l1: 'Travel', l2: 'Line 6: Auto & Travel', l3: 'Fuel' } }
];

async function seedDatabase() {
  const batch = db.batch();
  
  console.log("Starting seed with 4-level tax-aligned categories...");

  for (const group of globalRules) {
    for (const keyword of group.keywords) {
        const cleanId = keyword.toUpperCase()
            .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "_")
            .replace(/\s+/g, '_');

        const docRef = db.collection('globalVendorMap').doc(cleanId);
        
        // Use the new 4-level structure
        batch.set(docRef, {
            originalKeyword: keyword,
            categoryHierarchy: group.categoryHierarchy,
            source: 'global_seed_v3'
        }, { merge: true }); // Use merge to avoid overwriting user custom rules
    }
  }

  await batch.commit();
  console.log("Database seeded successfully with updated taxonomy!");
}

seedDatabase().catch(console.error);

