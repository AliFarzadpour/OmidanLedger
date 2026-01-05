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
const path = __importStar(require("path"));
// 1. Initialize Admin SDK
const serviceAccountPath = path.join(process.cwd(), 'service-account.json');
try {
    const serviceAccount = require(serviceAccountPath);
    if (admin.apps.length === 0) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    }
}
catch (error) {
    console.error("Could not initialize Admin SDK. Ensure service-account.json is present.", error);
    process.exit(1);
}
const db = admin.firestore();
// 2. New, more comprehensive seed data provided by user
const VENDOR_CATEGORY_SEED = {
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
function getCategoryHierarchy(l2String) {
    if (l2String.startsWith("Schedule E")) {
        return { l0: "OPERATING EXPENSE", l1: "Property Operations (Rentals)", l2: l2String };
    }
    if (l2String.includes("Car & Truck") || l2String.includes("Travel") || l2String.includes("Meals")) {
        return { l0: "EXPENSE", l1: "Vehicle & Travel", l2: l2String };
    }
    if (l2String.includes("Office Expense") || l2String.includes("Supplies") || l2String.includes("Utilities") || l2String.includes("Other Expenses")) {
        return { l0: "OPERATING EXPENSE", l1: "Office & Administrative (Business)", l2: l2String };
    }
    if (l2String.includes("Taxes & Licenses")) {
        return { l0: "OPERATING EXPENSE", l1: "Payroll & People", l2: l2String };
    }
    if (l2String.includes("Advertising")) {
        return { l0: "EXPENSE", l1: "Marketing & Sales", l2: l2String };
    }
    // Default fallback
    return { l0: "EXPENSE", l1: "General", l2: l2String };
}
async function deleteCollection(collectionPath, batchSize) {
    const collectionRef = db.collection(collectionPath);
    const query = collectionRef.orderBy('__name__').limit(batchSize);
    return new Promise((resolve, reject) => {
        deleteQueryBatch(query, resolve).catch(reject);
    });
}
async function deleteQueryBatch(query, resolve) {
    const snapshot = await query.get();
    if (snapshot.size === 0) {
        return resolve(0);
    }
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });
    await batch.commit();
    process.nextTick(() => {
        deleteQueryBatch(query, resolve);
    });
}
async function seedDatabase() {
    try {
        // ---- START CLEANUP ----
        console.log("Starting cleanup of 'globalVendorMap' collection...");
        const collectionRef = db.collection('globalVendorMap');
        const snapshot = await collectionRef.limit(1).get();
        if (!snapshot.empty) {
            await deleteCollection('globalVendorMap', 100);
            console.log("Cleanup complete. All old rules have been deleted.");
        }
        else {
            console.log("'globalVendorMap' is already empty. No cleanup needed.");
        }
        // ---- END CLEANUP ----
        const batch = db.batch();
        console.log("Starting to seed Global Vendor Map with clean, new structure...");
        for (const [keyword, l2] of Object.entries(VENDOR_CATEGORY_SEED)) {
            const { l0, l1 } = getCategoryHierarchy(l2);
            const docRef = db.collection('globalVendorMap').doc(keyword);
            const ruleData = {
                originalKeyword: keyword,
                categoryHierarchy: {
                    l0,
                    l1,
                    l2,
                    l3: keyword.replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
                },
                source: 'global_seed_v6_comprehensive'
            };
            batch.set(docRef, ruleData);
        }
        await batch.commit();
        console.log(`Successfully seeded ${Object.keys(VENDOR_CATEGORY_SEED).length} clean rules into the globalVendorMap collection.`);
    }
    catch (error) {
        console.error("Error during seeding process:", error);
        throw error;
    }
}
seedDatabase().catch(console.error);
