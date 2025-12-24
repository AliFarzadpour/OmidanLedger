
// scripts/inspect-recent-transactions.ts
import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

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
    } else {
        throw new Error("service-account.json not found. Please ensure the file exists in your project root.");
    }
  } catch (error) {
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
        } else if (data.date.toDate instanceof Function) { // Firestore Timestamp check
          console.log("- 'date' field type: Timestamp");
        } else {
          console.log(`- 'date' field type: Unknown (${typeof data.date})`);
        }
      } else {
        console.log("- 'date' field: Not present");
      }
      
      console.log("\n");
    });

    console.log("Inspection complete.");

  } catch (error) {
    console.error("An error occurred during the inspection script:", error);
    process.exit(1);
  }
}

inspectRecentTransactions();
