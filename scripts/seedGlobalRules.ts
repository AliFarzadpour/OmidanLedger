
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
  { keywords: ['STARBUCKS', 'MCDONALD', 'CHICK-FIL-A', 'IN-N-OUT', 'DUNKIN', 'CHUY', 'CHEESECAKE', 'BRAUMS', 'ROADHOUSE', 'WHATABURGER', 'PANERA', 'DENNY', 'WENDY', 'BURGER KING', 'TACO BELL', 'TB REST', 'TB RET', 'MISSION RANCH MARKET', 'SAIZERIYA', 'SHAKE SHACK', 'PIZZA GUYS', 'THE COFFEE COMPANY', 'URTH CAFFE', 'MAGGIANOS'], 
    primary: 'Expense', secondary: 'Meals', sub: 'Line 19 Other', details: 'Business Meals' },
  
  // --- PERSONAL / RETAIL ---
  { keywords: ['TJ MAXX', 'MACY', 'NORDSTROM', 'DILLARD', 'MARSHALLS', 'ROSS', 'H&M', 'ZARA', 'UNIQLO', 'SKECHERS', 'NIKE', 'ADIDAS', 'LULULEMON', 'SEPHORA', 'ULTA', 'CALVIN', 'NAUTICA', 'COLUMBIA', 'STONEBRIAR', 'BEYOND CLIPS', 'SAFFRON & ROSE ICE CRE', 'CA PARKS YODEL PARK'], 
    primary: 'Equity', secondary: "Owner Distribution", sub: 'Personal Draw', details: 'Personal Spending' },

  // --- OFFICE, REPAIRS, & SUPPLIES ---
  { keywords: ['OFFICE DEPOT', 'STAPLES'], 
    primary: 'Expense', secondary: 'Supplies', sub: 'Line 15 Supplies', details: 'Office Supplies' },
  { keywords: ['HOME DEPOT', 'LOWES', 'MICRO CENTER'], 
    primary: 'Expense', secondary: 'Repairs', sub: 'Line 14 Repairs', details: 'Materials & Supplies' },
  { keywords: ['AMAZON', 'WALMART', 'TARGET', 'COSTCO', 'SAMS CLUB'], 
    primary: 'Expense', secondary: 'Supplies', sub: 'Line 15 Supplies', details: 'General Supplies' },

  // --- SOFTWARE & SUBSCRIPTIONS ---
  { keywords: ['OPENAI', 'CHATGPT', 'DIGITALOCEAN', 'GODADDY', 'NAME-CHEAP', 'ADOBE', 'INTUIT', 'GOOGLE', 'MICROSOFT', 'VPN', 'ESIGN', 'TRADE IDEAS', 'GSUITE', 'AWS', 'CLOUD', 'INVIDEO', 'ADROLL', 'AMAZON PRIME'], 
    primary: 'Expense', secondary: 'General & Administrative', sub: 'Line 19 Other', details: 'Software & Subscriptions' },

  // --- TRAVEL & TRANSPORTATION ---
  { keywords: ['TRIP.COM', 'EXPEDIA', 'KLOOK', 'AGODA', 'AIRBNB', 'HOTEL', 'INN', 'LODGE', 'RESORT', 'HILTON', 'SHERATON', 'MARRIOTT', 'HYATT', 'WESTIN', 'FAIRMONT', 'SIXT', 'HERTZ', 'AVIS', 'BUDGET', 'ENTERPRISE', 'TRAVELOCITY', 'WISECARS'], 
    primary: 'Expense', secondary: 'Travel', sub: 'Line 6 Auto & Travel', details: 'Travel & Lodging' },
  { keywords: ['AMERICAN AIR', 'DELTA', 'UNITED', 'SOUTHWEST', 'FRONTIER A', 'FRONTIER K', 'AMERICAN 00122'],
    primary: 'Expense', secondary: 'Travel', sub: 'Line 6 Auto & Travel', details: 'Airfare' },
  { keywords: ['NTTA'],
    primary: 'Expense', secondary: 'Travel', sub: 'Line 6 Auto & Travel', details: 'Tolls'},
  { keywords: ['SAN CLEMENTE PARKING'],
    primary: 'Expense', secondary: 'Travel', sub: 'Line 6 Auto & Travel', details: 'Parking'},

  // --- UTILITIES & GOVERNMENT ---
  { keywords: ['CITY OF', 'TOWN OF', 'WATER', 'ELECTRIC', 'POWER', 'ATMOS', 'WASTE', 'TRASH', 'FRONTIER', 'VERIZON', 'AT&T', 'T-MOBILE'], 
    primary: 'Expense', secondary: 'Utilities', sub: 'Line 17 Utilities', details: 'General Utilities' },
  { keywords: ['CITITURF', 'CITY OF LAGUNA BEACH'],
    primary: 'Expense', secondary: 'Taxes', sub: 'Line 16 Taxes', details: 'Municipal Fees' },
  
  // --- MARKETING ---
  { keywords: ['ADS9577534252'], // Example of an opaque ad network ID
    primary: 'Expense', secondary: 'Marketing', sub: 'Line 5 Advertising', details: 'Digital Ads' },


  // --- FUEL ---
  { keywords: ['SHELL', 'EXXON', 'CHEVRON', 'QT', 'QUIKTRIP', '7-ELEVEN', 'RACETRAC', 'CIRCLE K', 'PHILLIPS 66', 'CONOCO', 'CENEX'], 
    primary: 'Expense', secondary: 'Travel', sub: 'Line 6 Auto & Travel', details: 'Fuel' }
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
            primary: group.primary,     // L0
            secondary: group.secondary, // L1
            sub: group.sub,             // L2 (Tax Line)
            details: group.details,     // L3 (Detail)
            source: 'global_seed_v2'
        }, { merge: true }); // Use merge to avoid overwriting user custom rules
    }
  }

  await batch.commit();
  console.log("Database seeded successfully with updated taxonomy!");
}

seedDatabase().catch(console.error);
