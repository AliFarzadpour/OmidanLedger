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
// scripts/analyze-categories.ts
const admin = __importStar(require("firebase-admin"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
// Initialize Firebase Admin SDK
function initializeAdminApp() {
    const serviceAccountPath = path.join(process.cwd(), 'service-account.json');
    try {
        // Check if the file exists before trying to require it
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
async function analyzeTransactionCategories() {
    try {
        initializeAdminApp();
        const db = admin.firestore();
        console.log("Firebase Admin SDK initialized. Starting analysis...");
        const transactionsSnapshot = await db.collectionGroup('transactions').get();
        if (transactionsSnapshot.empty) {
            console.log("No transactions found in the database.");
            return;
        }
        console.log(`Found ${transactionsSnapshot.size} total transactions. Analyzing categories...`);
        const categoryCounts = {};
        transactionsSnapshot.forEach(doc => {
            const data = doc.data();
            const primary = data.primaryCategory || 'Uncategorized';
            const sub = data.subcategory || 'Uncategorized';
            const key = `${primary} > ${sub}`;
            if (categoryCounts[key]) {
                categoryCounts[key].count++;
            }
            else {
                categoryCounts[key] = {
                    count: 1,
                    primary: primary,
                    sub: sub,
                };
            }
        });
        // Convert to a sorted array for cleaner output
        const sortedCategories = Object.entries(categoryCounts)
            .map(([key, value]) => ({
            category: key,
            ...value
        }))
            .sort((a, b) => b.count - a.count);
        console.log("\n--- Category Analysis Report ---");
        console.log(JSON.stringify(sortedCategories, null, 2));
        console.log("\nAnalysis complete. The JSON above shows all unique category combinations and their usage count.");
    }
    catch (error) {
        console.error("An error occurred during the analysis script:", error);
        process.exit(1);
    }
}
analyzeTransactionCategories();
