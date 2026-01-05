
// scripts/seedGlobalRules.ts
import * as admin from 'firebase-admin';
import * as path from 'path';

// 1. Initialize Admin SDK
const serviceAccountPath = path.join(process.cwd(), 'service-account.json');
try {
  const serviceAccount = require(serviceAccountPath); 
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
} catch (error) {
  console.error("Could not initialize Admin SDK. Ensure service-account.json is present.", error);
  process.exit(1);
}

const db = admin.firestore();

// 2. New, more comprehensive seed data provided by user
const VENDOR_CATEGORY_SEED: Record<string, string> = {
  // --- OFFICE & ADMIN (Schedule C, Line 18) ---
  "OFFICEDEPOT": "Schedule C, Line 18 — Office Expense",
  "OFFICEMAX": "Schedule C, Line 18 — Office Expense",
  "OFFICE_DEPOT": "Schedule C, Line 18 — Office Expense",
  "POSTOFFICE": "Schedule C, Line 18 — Office Expense",
  "STAPLES": "Schedule C, Line 18 — Office Expense",
  "UPS": "Schedule C, Line 18 — Office Expense",
  "USPS": "Schedule C, Line 18 — Office Expense",

  // --- SOFTWARE / SUBSCRIPTIONS (Schedule C, Line 27a) ---
  "OPENAI": "Schedule C, Line 27a — Software / Subscriptions",
  "TRADE_IDEAS": "Schedule C, Line 27a — Software / Subscriptions",
  "VPN": "Schedule C, Line 27a — Software / Subscriptions",

  // --- UTILITIES (Schedule C, Line 25) ---
  "PGE": "Schedule C, Line 25 — Utilities",
  "POWER": "Schedule C, Line 25 — Utilities",
  "SOCALGAS": "Schedule C, Line 25 — Utilities",
  "SPECTRUM": "Schedule C, Line 25 — Utilities",
  "SPRINT": "Schedule C, Line 25 — Utilities",
  "TMOBILE": "Schedule C, Line 25 — Utilities",
  "TRASH": "Schedule C, Line 25 — Utilities",
  "UTILITY": "Schedule C, Line 25 — Utilities",
  "VERIZON": "Schedule C, Line 25 — Utilities",
  "WASTE": "Schedule C, Line 25 — Utilities",
  "WASTEMGMT": "Schedule C, Line 25 — Utilities",
  "WATER": "Schedule C, Line 25 — Utilities",
  "WATERDIST": "Schedule C, Line 25 — Utilities",

  // --- MEALS (Schedule C, Line 24b) ---
  "PANERA": "Schedule C, Line 24b — Meals (50% deductible)",
  "ROADHOUSE": "Schedule C, Line 24b — Meals (50% deductible)",
  "SAIZERIYA": "Schedule C, Line 24b — Meals (50% deductible)",
  "SHAKESHACK": "Schedule C, Line 24b — Meals (50% deductible)",
  "STARBUCKS": "Schedule C, Line 24b — Meals (50% deductible)",
  "SUBWAY": "Schedule C, Line 24b — Meals (50% deductible)",
  "TACO_BELL": "Schedule C, Line 24b — Meals (50% deductible)",
  "TB_REST": "Schedule C, Line 24b — Meals (50% deductible)",
  "TB_RET": "Schedule C, Line 24b — Meals (50% deductible)",
  "URTHCAFFE": "Schedule C, Line 24b — Meals (50% deductible)",
  "WENDY": "Schedule C, Line 24b — Meals (50% deductible)",
  "WHATABURGER": "Schedule C, Line 24b — Meals (50% deductible)",

  // --- VEHICLE / GAS (Schedule C, Line 9) ---
  "NTTA": "Schedule C, Line 9 — Car & Truck Expenses",
  "PHILLIPS_66": "Schedule C, Line 9 — Car & Truck Expenses",
  "QT": "Schedule C, Line 9 — Car & Truck Expenses",
  "QUALITY": "Schedule C, Line 9 — Car & Truck Expenses",
  "QUIKTRIP": "Schedule C, Line 9 — Car & Truck Expenses",
  "RACETRAC": "Schedule C, Line 9 — Car & Truck Expenses",
  "SHELL": "Schedule C, Line 9 — Car & Truck Expenses",

  // --- TRAVEL (Schedule C, Line 24a) ---
  "RESORT": "Schedule C, Line 24a — Travel",
  "SHERATON": "Schedule C, Line 24a — Travel",
  "SIXT": "Schedule C, Line 24a — Travel",
  "SOUTHWEST": "Schedule C, Line 24a — Travel",
  "TRAVELOCITY": "Schedule C, Line 24a — Travel",
  "TRIPCOM": "Schedule C, Line 24a — Travel",
  "TRIP_COM": "Schedule C, Line 24a — Travel",
  "UBER": "Schedule C, Line 24a — Travel",
  "UNITED": "Schedule C, Line 24a — Travel",
  "UNITEDAIR": "Schedule C, Line 24a — Travel",
  "WESTIN": "Schedule C, Line 24a — Travel",
  "WISECARS": "Schedule C, Line 24a — Travel",

  // --- SUPPLIES / SHOPPING (Schedule C, Line 22) ---
  "SAMSCLUB": "Schedule C, Line 22 — Supplies",
  "SAMS_CLUB": "Schedule C, Line 22 — Supplies",
  "STONEBRIAR": "Schedule C, Line 22 — Supplies", 
  "TARGET": "Schedule C, Line 22 — Supplies",
  "WALGREENS": "Schedule C, Line 22 — Supplies",
  "WALMART": "Schedule C, Line 22 — Supplies",

  // --- UNIFORMS / CLOTHING (Mapped to Other Expenses) ---
  "NORDSTROM": "Schedule C, Line 27a — Other Expenses",
  "ROSS": "Schedule C, Line 27a — Other Expenses",
  "SEPHORA": "Schedule C, Line 27a — Other Expenses",
  "SKECHERS": "Schedule C, Line 27a — Other Expenses",
  "TJMAXX": "Schedule C, Line 27a — Other Expenses",
  "TJ_MAXX": "Schedule C, Line 27a — Other Expenses",
  "ULTA": "Schedule C, Line 27a — Other Expenses",
  "UNIQLO": "Schedule C, Line 27a — Other Expenses",
  "ZARA": "Schedule C, Line 27a — Other Expenses",

  // --- REPAIRS (Schedule E, Line 14) ---
  "PLUMBING": "Schedule E, Line 14 — Repairs",
  "ROOFING": "Schedule E, Line 14 — Repairs",
  "SHERWIN": "Schedule E, Line 14 — Repairs",
  "SHERWINWILLIAMS": "Schedule E, Line 14 — Repairs",

  // --- TAXES & LICENSES ---
  "NOTARY": "Schedule C, Line 23 — Taxes & Licenses",
  "PROPERTYTAX": "Schedule E, Line 16 — Taxes",
  "SECRETARY": "Schedule C, Line 23 — Taxes & Licenses",
  "TOWN_OF": "Schedule C, Line 23 — Taxes & Licenses",
  "USTREASURY": "Schedule C, Line 23 — Taxes & Licenses",

  // --- INSURANCE (Schedule E, Line 9) ---
  "PROGRESSIVE": "Schedule E, Line 9 — Insurance",
  "STATEFARM": "Schedule E, Line 9 — Insurance",
  "UNITEDHEALTH": "Schedule E, Line 9 — Insurance",

  // --- ADVERTISING (Schedule C, Line 8) ---
  "YELPADS": "Schedule C, Line 8 — Advertising",
  "ZILLOW": "Schedule C, Line 8 — Advertising",
};

// 3. Helper function to map L2 tax lines back to L0/L1 structure
function getCategoryHierarchy(l2String: string): { l0: string; l1: string } {
    if (l2String.startsWith("Schedule E")) {
        return { l0: "OPERATING EXPENSE", l1: "Property Operations (Rentals)" };
    }
    if (l2String.includes("Car & Truck") || l2String.includes("Travel") || l2String.includes("Meals")) {
        return { l0: "EXPENSE", l1: "Vehicle & Travel" };
    }
    if (l2String.includes("Office Expense") || l2String.includes("Supplies") || l2String.includes("Utilities") || l2String.includes("Other Expenses")) {
        return { l0: "OPERATING EXPENSE", l1: "Office & Administrative (Business)" };
    }
    if (l2String.includes("Taxes & Licenses")) {
        return { l0: "OPERATING EXPENSE", l1: "Payroll & People" };
    }
     if (l2String.includes("Advertising")) {
        return { l0: "EXPENSE", l1: "Marketing & Sales" };
    }
    // Default fallback
    return { l0: "EXPENSE", l1: "General" };
}


async function seedDatabase() {
  const batch = db.batch();
  
  console.log("Starting to seed Global Vendor Map with new structure...");

  for (const [keyword, l2] of Object.entries(VENDOR_CATEGORY_SEED)) {
    const { l0, l1 } = getCategoryHierarchy(l2);
    
    // Use the keyword as the document ID for consistency and to prevent duplicates
    const docRef = db.collection('globalVendorMap').doc(keyword);
    
    const ruleData = {
        originalKeyword: keyword, // Store the human-readable keyword
        categoryHierarchy: {
            l0,
            l1,
            l2,
            l3: keyword.replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') // Auto-generate L3
        },
        source: 'global_seed_v5_comprehensive'
    };

    batch.set(docRef, ruleData, { merge: true });
  }

  try {
    await batch.commit();
    console.log(`Successfully seeded/updated ${Object.keys(VENDOR_CATEGORY_SEED).length} rules in the globalVendorMap collection.`);
  } catch (error) {
    console.error("Error committing batch:", error);
    throw error;
  }
}

seedDatabase().catch(console.error);
