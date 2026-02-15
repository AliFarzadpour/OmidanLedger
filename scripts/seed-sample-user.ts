
// scripts/seed-sample-user.ts
import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';
import { faker } from '@faker-js/faker';
import { v4 as uuidv4 } from 'uuid';

// --- CONFIGURATION ---
const TARGET_USER_EMAIL = 'SampleData@Example.com';

// 1. Initialize Firebase Admin SDK
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
        throw new Error("service-account.json not found. Please ensure it exists in your project root.");
    }
  } catch (error) {
    console.error("Error initializing Firebase Admin SDK:", error);
    process.exit(1);
  }
}

// Function to delete all data for a specific user
async function deleteExistingData(userId: string, db: admin.firestore.Firestore) {
    console.log(`Deleting existing data for user ${userId}...`);
    const collectionsToDelete = ['properties', 'vendors', 'invoices', 'bills', 'tenantProfiles', 'opsThreads', 'opsTasks', 'opsWorkOrders'];
    const batch = db.batch();

    for (const collectionName of collectionsToDelete) {
        const snapshot = await db.collection(collectionName).where('userId', '==', userId).get();
        if (!snapshot.empty) {
            console.log(`- Deleting ${snapshot.size} documents from ${collectionName}`);
            snapshot.docs.forEach(doc => batch.delete(doc.ref));
        }
    }
    
    // Deleting user subcollections
    const userSubcollections = ['bankAccounts', 'categoryMappings', 'admin_invoices', 'charges', 'settings', 'opsThreads', 'opsTasks', 'opsWorkOrders'];
     for (const collectionName of userSubcollections) {
        const snapshot = await db.collection('users').doc(userId).collection(collectionName).get();
        if (!snapshot.empty) {
            console.log(`- Deleting ${snapshot.size} documents from users/${userId}/${collectionName}`);
            snapshot.docs.forEach(doc => batch.delete(doc.ref));
        }
    }
    
    await batch.commit();
    console.log('Existing data cleared.');
}

async function runSeeder() {
  console.log(`--- Starting Sample Data Seeder for ${TARGET_USER_EMAIL} ---`);
  initializeAdminApp();

  const db = admin.firestore();
  const auth = admin.auth();

  // 1. Find the user by email
  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(TARGET_USER_EMAIL);
  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      console.error(`\n[FATAL ERROR] User with email "${TARGET_USER_EMAIL}" not found in Firebase Authentication.`);
      console.error("Please create this user in the Firebase Console before running the seeder.");
      process.exit(1);
    }
    throw error;
  }

  const userId = userRecord.uid;
  console.log(`Found user: ${userId}`);
  
  // 2. Clear any pre-existing data for this user to ensure a clean slate
  await deleteExistingData(userId, db);

  const batch = db.batch();

  // 3. Create/Update User Document
  const userRef = db.collection('users').doc(userId);
  batch.set(userRef, {
      uid: userId,
      email: TARGET_USER_EMAIL,
      role: 'landlord',
      businessProfile: { businessName: 'Sample Holdings LLC' },
      billing: { subscriptionTier: 'pro', status: 'active' },
      metadata: { createdAt: new Date() }
  }, { merge: true });

  // 4. Create Bank Accounts
  const checkingAccountId = uuidv4();
  const creditCardAccountId = uuidv4();
  batch.set(db.collection('users').doc(userId).collection('bankAccounts').doc(checkingAccountId), {
      userId,
      accountName: 'Chase Business Checking',
      bankName: 'Chase',
      accountType: 'checking',
      accountNumber: '...1234'
  });
  batch.set(db.collection('users').doc(userId).collection('bankAccounts').doc(creditCardAccountId), {
      userId,
      accountName: 'Amex Business Card',
      bankName: 'American Express',
      accountType: 'credit-card',
      accountNumber: '...5678'
  });
  
  // 5. Create Properties and Tenants
  const sfhId = uuidv4();
  const mfhId = uuidv4();
  
  // Single Family Home
  batch.set(db.collection('properties').doc(sfhId), {
      userId,
      id: sfhId,
      name: 'The Lake House',
      type: 'single-family',
      address: { street: '123 Lakeview Dr', city: 'Austin', state: 'TX', zip: '78745' },
      tenants: [{
          firstName: 'Alice', lastName: 'Johnson', email: 'alice.j@example.com',
          leaseStart: '2023-08-01', leaseEnd: '2024-07-31', status: 'active',
          rentHistory: [{ amount: 2500, effectiveDate: '2023-08-01'}]
      }],
      mortgage: { hasMortgage: 'yes', originalLoanAmount: 300000, loanTerm: 30, interestRate: 6.5, purchaseDate: '2022-01-15', lenderName: 'Wells Fargo Home Mortgage', principalAndInterest: 1850, escrowAmount: 450 },
  });

  // Multi-Family Home
  batch.set(db.collection('properties').doc(mfhId), {
      userId,
      id: mfhId,
      name: 'Downtown Apartments',
      type: 'multi-family',
      isMultiUnit: true,
      address: { street: '456 Main St', city: 'Austin', state: 'TX', zip: '78701' },
  });
  
  // Units for MFH
  const unit1Id = uuidv4();
  const unit2Id = uuidv4();
  const unit3Id = uuidv4();
  batch.set(db.collection('properties').doc(mfhId).collection('units').doc(unit1Id), {
      userId, propertyId: mfhId, unitNumber: '101', status: 'occupied',
      tenants: [{
          firstName: 'Bob', lastName: 'Williams', email: 'bob.w@example.com',
          leaseStart: '2023-06-01', leaseEnd: '2024-05-31', status: 'active',
          rentHistory: [{ amount: 1200, effectiveDate: '2023-06-01'}]
      }]
  });
   batch.set(db.collection('properties').doc(mfhId).collection('units').doc(unit2Id), {
      userId, propertyId: mfhId, unitNumber: '102', status: 'vacant'
  });
   batch.set(db.collection('properties').doc(mfhId).collection('units').doc(unit3Id), {
      userId, propertyId: mfhId, unitNumber: '201', status: 'occupied',
      tenants: [{
          firstName: 'Charlie', lastName: 'Brown', email: 'charlie.b@example.com',
          leaseStart: '2024-01-01', leaseEnd: '2024-12-31', status: 'active',
          rentHistory: [{ amount: 1350, effectiveDate: '2024-01-01'}]
      }]
  });

  // 6. Create Transactions
  const createTx = (bankAccountId: string, description: string, amount: number, date: string, costCenter: string, category: { l0: string, l1: string, l2: string, l3: string }) => {
    const txId = uuidv4();
    const txRef = db.collection('users').doc(userId).collection('bankAccounts').doc(bankAccountId).collection('transactions').doc(txId);
    batch.set(txRef, {
      id: txId,
      userId,
      bankAccountId,
      description,
      amount,
      date,
      costCenter,
      categoryHierarchy: category,
      reviewStatus: 'approved'
    });
  };

  // --- Income Transactions ---
  createTx(checkingAccountId, 'Zelle from Alice Johnson', 2500, '2024-03-01', sfhId, {l0: 'INCOME', l1: 'Rental Income', l2: 'Line 3: Rents Received', l3: 'Alice Johnson'});
  createTx(checkingAccountId, 'Zelle from Bob Williams', 1200, '2024-03-01', unit1Id, {l0: 'INCOME', l1: 'Rental Income', l2: 'Line 3: Rents Received', l3: 'Bob Williams'});
  createTx(checkingAccountId, 'Zelle from Charlie Brown', 1350, '2024-03-01', unit3Id, {l0: 'INCOME', l1: 'Rental Income', l2: 'Line 3: Rents Received', l3: 'Charlie Brown'});
  createTx(checkingAccountId, 'Zelle from Alice Johnson', 2500, '2024-02-01', sfhId, {l0: 'INCOME', l1: 'Rental Income', l2: 'Line 3: Rents Received', l3: 'Alice Johnson'});
  createTx(checkingAccountId, 'Zelle from Bob Williams', 1200, '2024-02-01', unit1Id, {l0: 'INCOME', l1: 'Rental Income', l2: 'Line 3: Rents Received', l3: 'Bob Williams'});
  
  // --- Expense Transactions ---
  createTx(checkingAccountId, 'Wells Fargo Home Mortgage', -2300, '2024-03-01', sfhId, {l0: 'LIABILITY', l1: 'Loan Paydown', l2: 'Mortgage Principal', l3: 'Wells Fargo'});
  createTx(checkingAccountId, 'City of Austin Utilities', -150, '2024-02-25', mfhId, {l0: 'OPERATING EXPENSE', l1: 'Property Operations (Rentals)', l2: 'Line 17: Utilities', l3: 'Downtown Apts - Common Area'});
  createTx(checkingAccountId, 'Home Depot', -250.78, '2024-02-20', sfhId, {l0: 'OPERATING EXPENSE', l1: 'Repairs', l2: 'Line 14: Repairs', l3: 'Plumbing parts'});
  createTx(checkingAccountId, 'AT&T Internet', -80, '2024-02-18', mfhId, {l0: 'OPERATING EXPENSE', l1: 'Property Operations (Rentals)', l2: 'Line 17: Utilities', l3: 'Common Area Internet'});
  createTx(creditCardAccountId, 'Amazon - Supplies', -75.50, '2024-02-15', '', {l0: 'OPERATING EXPENSE', l1: 'Office & Administrative (Business)', l2: 'Schedule C, Line 22 — Supplies', l3: 'Office Supplies'});
  createTx(creditCardAccountId, 'HEB Grocery', -124.30, '2024-02-14', '', {l0: 'EQUITY', l1: 'Owner / Shareholder Equity', l2: 'Owner Distributions', l3: 'Personal Groceries'});
  createTx(checkingAccountId, 'Online Payment to Amex', -500, '2024-02-28', '', {l0: 'ASSET', l1: 'Cash Movement', l2: 'Internal Transfer', l3: 'Credit Card Payment'});
  
  // --- 7. Create Operations Center Data ---
  const workOrderId1 = uuidv4();
  const workOrderId2 = uuidv4();
  const threadId1 = uuidv4();
  const taskId1 = uuidv4();

  // Work Order for the Lake House
  batch.set(db.collection('users').doc(userId).collection('opsWorkOrders').doc(workOrderId1), {
      id: workOrderId1,
      userId,
      propertyId: sfhId,
      title: 'Fix Leaky Kitchen Faucet',
      description: 'Tenant Alice Johnson reported a constant drip from the kitchen faucet.',
      category: 'Plumbing',
      priority: 'High',
      status: 'New',
      createdAt: new Date('2024-03-05T10:00:00Z').toISOString(),
      updatedAt: new Date('2024-03-05T10:00:00Z').toISOString(),
      createdBy: 'System Seed',
  });

  // Work Order for Downtown Apt 101
  batch.set(db.collection('users').doc(userId).collection('opsWorkOrders').doc(workOrderId2), {
      id: workOrderId2,
      userId,
      propertyId: mfhId,
      unitId: unit1Id,
      title: 'AC Not Cooling',
      description: 'Tenant Bob Williams reports the AC is running but not cooling the unit.',
      category: 'HVAC',
      priority: 'Normal',
      status: 'Scheduled',
      scheduledAt: new Date('2024-03-10T14:00:00Z').toISOString(),
      createdAt: new Date('2024-03-08T18:00:00Z').toISOString(),
      updatedAt: new Date('2024-03-09T09:00:00Z').toISOString(),
      createdBy: 'System Seed',
  });

  // Communication Thread for the Leaky Faucet
  batch.set(db.collection('users').doc(userId).collection('opsThreads').doc(threadId1), {
      uid: threadId1,
      subject: 'Re: Leaky Kitchen Faucet',
      status: 'open',
      priority: 'high',
      propertyId: sfhId,
      tenantId: 'alice.j@example.com', // Using email as a reference for sample data
      lastMessageAt: new Date('2024-03-05T11:05:00Z').toISOString(),
      createdAt: new Date('2024-03-05T10:05:00Z').toISOString(),
      updatedAt: new Date('2024-03-05T11:05:00Z').toISOString(),
  });

  // Messages for the thread
  const messageId1 = uuidv4();
  const messageId2 = uuidv4();
  batch.set(db.collection('users').doc(userId).collection('opsThreads').doc(threadId1).collection('messages').doc(messageId1), {
      uid: messageId1,
      threadId: threadId1,
      senderType: 'tenant',
      senderName: 'Alice Johnson',
      senderEmail: 'alice.j@example.com',
      body: 'Hi, just confirming the plumber is scheduled for tomorrow at 2 PM. Will that work?',
      createdAt: new Date('2024-03-05T10:05:00Z').toISOString(),
  });
   batch.set(db.collection('users').doc(userId).collection('opsThreads').doc(threadId1).collection('messages').doc(messageId2), {
      uid: messageId2,
      threadId: threadId1,
      senderType: 'landlord',
      senderName: 'Sample Landlord',
      senderEmail: TARGET_USER_EMAIL,
      body: 'Yes, that works. Thanks for confirming, Alice!',
      createdAt: new Date('2024-03-05T11:05:00Z').toISOString(),
  });

  // A standalone task
  batch.set(db.collection('users').doc(userId).collection('opsTasks').doc(taskId1), {
      uid: taskId1,
      title: 'Renew business license by end of month',
      status: 'todo',
      priority: 'normal',
      dueDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
  });


  // 8. Commit the batch
  try {
    await batch.commit();
    console.log(`\n🎉 Success! Sample data has been seeded for ${TARGET_USER_EMAIL}.`);
  } catch (error) {
    console.error("\n[FATAL ERROR] Firestore batch commit failed.", error);
    process.exit(1);
  }
}

runSeeder().catch(console.error);
