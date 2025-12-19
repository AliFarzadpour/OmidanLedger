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
// scripts/seedGlobalRules.ts
const admin = __importStar(require("firebase-admin"));
// 1. Initialize Admin SDK (Run this locally with service account credentials)
// Download your service-account-key.json from Firebase Console > Project Settings > Service Accounts
const serviceAccount = require('./service-account-key.json');
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
            const cleanId = keyword.toUpperCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").replace(/\s/g, '_');
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
