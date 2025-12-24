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
// scripts/inspect-recent-transactions.ts
const admin = __importStar(require("firebase-admin"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
// Initialize Firebase Admin SDK
function initializeAdminApp() {
    const serviceAccountPath = path.join(process.cwd(), 'service-account.json');
    try {
        if (fs.existsSync(serviceAccountPath)) {
            const serviceAccount = require(serviceAccountPath);
            if (admin.apps.length === 0) {
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount)
                });
            }
        }
        else {
            throw new Error("service-account.json not found. Please ensure the file exists in your project root.");
        }
    }
    catch (error) {
        console.error("Error initializing Firebase Admin SDK:", error);
        process.exit(1);
    }
}
async function inspectRecentTransactions() {
    try {
        initializeAdminApp();
        const db = admin.firestore();
        console.log("Firebase Admin SDK initialized. Fetching recent transactions...");
        const transactionsRef = db.collectionGroup('transactions');
        const snapshot = await transactionsRef.orderBy('date', 'desc').limit(5).get();
        if (snapshot.empty) {
            console.log("No transactions found in the database.");
            return;
        }
        console.log(`\n--- Found ${snapshot.size} most recent transactions ---\n`);
        snapshot.forEach(doc => {
            const data = doc.data();
            console.log(`Document ID: ${doc.id}`);
            console.log("------------------------------------------");
            console.log(JSON.stringify(data, null, 2));
            console.log("------------------------------------------");
            // Field presence checks
            console.log(`- Has 'bankAccountId': ${data.hasOwnProperty('bankAccountId')}`);
            console.log(`- Has 'amount': ${data.hasOwnProperty('amount')}`);
            console.log(`- Has 'categoryHierarchy': ${data.hasOwnProperty('categoryHierarchy')}`);
            console.log(`- Has 'reviewStatus': ${data.hasOwnProperty('reviewStatus')}`);
            // Date type check
            if (data.date) {
                if (typeof data.date === 'string') {
                    console.log("- 'date' field type: String");
                }
                else if (data.date.toDate instanceof Function) { // Firestore Timestamp check
                    console.log("- 'date' field type: Timestamp");
                }
                else {
                    console.log(`- 'date' field type: Unknown (${typeof data.date})`);
                }
            }
            else {
                console.log("- 'date' field: Not present");
            }
            console.log("\n");
        });
        console.log("Inspection complete.");
    }
    catch (error) {
        console.error("An error occurred during the inspection script:", error);
        process.exit(1);
    }
}
inspectRecentTransactions();
