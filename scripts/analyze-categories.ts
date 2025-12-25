
// scripts/analyze-categories.ts
import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

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
    } else {
        throw new Error("service-account.json not found. Please ensure the file exists in your project root.");
    }
  } catch (error) {
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

    const categoryCounts: { [key: string]: { count: number; primary: string; sub: string } } = {};

    transactionsSnapshot.forEach(doc => {
      const data = doc.data();
      const primary = data.primaryCategory || 'Uncategorized';
      const sub = data.subcategory || 'Uncategorized';
      
      const key = `${primary} > ${sub}`;

      if (categoryCounts[key]) {
        categoryCounts[key].count++;
      } else {
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

  } catch (error) {
    console.error("An error occurred during the analysis script:", error);
    process.exit(1);
  }
}

analyzeTransactionCategories();
