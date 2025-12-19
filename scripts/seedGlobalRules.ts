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

// 2. Define the Master List (The "Universal Truths")
const globalRules = [
  // RESTAURANTS
  { keywords: ['STARBUCKS', 'MCDONALD', 'CHICK-FIL-A', 'IN-N-OUT', 'DUNKIN', 'CHUY', 'CHEESECAKE', 'BRAUMS', 'ROADHOUSE', 'WHATABURGER', 'PANERA', 'DENNY', 'WENDY', 'BURGER KING', 'TACO BELL', 'TB REST', 'TB RET'], 
    primary: 'Operating Expenses', secondary: 'Meals & Entertainment', sub: 'Business Meals' },
  
  // RETAIL / PERSONAL
  { keywords: ['TJ MAXX', 'MACY', 'NORDSTROM', 'DILLARD', 'MARSHALLS', 'ROSS', 'H&M', 'ZARA', 'UNIQLO', 'SKECHERS', 'NIKE', 'ADIDAS', 'LULULEMON', 'SEPHORA', 'ULTA', 'CALVIN', 'NAUTICA', 'COLUMBIA', 'STONEBRIAR', 'BEYOND CLIPS'], 
    primary: 'Equity', secondary: "Owner's Draw", sub: 'Personal Expense' },

  // OFFICE SUPPLIES
  { keywords: ['OFFICE DEPOT', 'STAPLES', 'HOME DEPOT', 'LOWES', 'AMAZON', 'COSTCO', 'WALMART', 'TARGET', 'SAMS CLUB', 'MICRO CENTER'], 
    primary: 'Operating Expenses', secondary: 'Office Expenses', sub: 'Supplies' },

  // SOFTWARE
  { keywords: ['OPENAI', 'CHATGPT', 'DIGITALOCEAN', 'GODADDY', 'NAME-CHEAP', 'ADOBE', 'INTUIT', 'GOOGLE', 'MICROSOFT', 'VPN', 'ESIGN', 'TRADE IDEAS', 'GSUITE', 'AWS', 'CLOUD', 'INVIDEO'], 
    primary: 'Operating Expenses', secondary: 'General & Administrative', sub: 'Software & Subscriptions' },

  // TRAVEL
  { keywords: ['TRIP.COM', 'EXPEDIA', 'KLOOK', 'AGODA', 'AIRBNB', 'HOTEL', 'INN', 'LODGE', 'RESORT', 'HILTON', 'SHERATON', 'MARRIOTT', 'HYATT', 'WESTIN', 'FAIRMONT', 'SIXT', 'HERTZ', 'AVIS', 'BUDGET', 'ENTERPRISE', 'FRONTIER A', 'FRONTIER K', 'AMERICAN AIR', 'DELTA', 'UNITED', 'SOUTHWEST'], 
    primary: 'Operating Expenses', secondary: 'Vehicle & Travel', sub: 'Travel & Lodging' },

  // UTILITIES & GOV
  { keywords: ['CITY OF', 'TOWN OF', 'WATER', 'ELECTRIC', 'POWER', 'ATMOS', 'WASTE', 'TRASH', 'FRONTIER'], 
    primary: 'Operating Expenses', secondary: 'General & Administrative', sub: 'Rent & Utilities' },

  // FUEL
  { keywords: ['SHELL', 'EXXON', 'CHEVRON', 'QT', 'QUIKTRIP', '7-ELEVEN', 'RACETRAC', 'CIRCLE K', 'PHILLIPS 66', 'CONOCO', 'CENEX'], 
    primary: 'Operating Expenses', secondary: 'Vehicle & Travel', sub: 'Fuel' }
];

async function seedDatabase() {
  const batch = db.batch();
  
  console.log("Starting seed...");

  for (const group of globalRules) {
    // We create a document for EACH keyword so lookup is fast O(1)
    // Doc ID: "STARBUCKS" -> Data: { category: "Meals" }
    for (const keyword of group.keywords) {
        // Create a clean ID: "FRONTIER K" -> "FRONTIER_K"
        const cleanId = keyword.toUpperCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"").replace(/\s/g, '_');
        const docRef = db.collection('globalVendorMap').doc(cleanId);
        
        batch.set(docRef, {
            originalKeyword: keyword,
            primary: group.primary,
            secondary: group.secondary,
            sub: group.sub,
            source: 'global_seed'
        });
    }
  }

  await batch.commit();
  console.log("Database seeded successfully!");
}

seedDatabase().catch(console.error);
