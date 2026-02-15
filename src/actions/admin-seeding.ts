
'use server';

import { getAdminDb, getAdminAuth } from '@/lib/firebaseAdmin';
import { isSuperAdmin } from '@/lib/auth-utils';
import { faker } from '@faker-js/faker';
import { v4 as uuidv4 } from 'uuid';

const TARGET_USER_EMAIL = 'sampledata@example.com';

async function deleteExistingData(userId: string, db: FirebaseFirestore.Firestore) {
    console.log(`[SEEDER] Deleting data for user: ${userId}`);
    const batch = db.batch();
    let deleteCount = 0;

    // --- Top-level collections ---
    const collectionsToDelete = ['properties', 'vendors', 'invoices', 'bills'];
    for (const collectionName of collectionsToDelete) {
        const snapshot = await db.collection(collectionName).where('userId', '==', userId).get();
        if (!snapshot.empty) {
            console.log(`[SEEDER] Found ${snapshot.size} docs in ${collectionName} to delete.`);
            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
                deleteCount++;
            });
        }
    }

    // --- User subcollections ---
    const userSubcollections = ['bankAccounts', 'categoryMappings', 'admin_invoices', 'charges', 'settings', 'opsThreads', 'opsTasks', 'opsWorkOrders', 'tenantProfiles'];
    for (const subCollection of userSubcollections) {
        const snapshot = await db.collection('users').doc(userId).collection(subCollection).get();
        if (!snapshot.empty) {
            console.log(`[SEEDER] Found ${snapshot.size} docs in users/${userId}/${subCollection} to delete.`);
            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
                deleteCount++;
            });
        }
    }
    
    if (deleteCount > 0) {
        console.log(`[SEEDER] Committing batch to delete ${deleteCount} documents.`);
        await batch.commit();
        console.log(`[SEEDER] Deletion complete.`);
    } else {
        console.log(`[SEEDER] No existing data found to delete.`);
    }
}


export async function seedSampleData(currentUserId: string) {
    // 1. Authorize
    const isAdmin = await isSuperAdmin(currentUserId);
    if (!isAdmin) {
        throw new Error('Permission Denied: You must be an admin to perform this action.');
    }

    const adminAuth = getAdminAuth();
    const db = getAdminDb();

    // 2. Find user
    let userRecord;
    try {
        userRecord = await adminAuth.getUserByEmail(TARGET_USER_EMAIL);
    } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
            throw new Error(`User with email "${TARGET_USER_EMAIL}" not found. Please create them in Firebase Authentication first.`);
        }
        throw error;
    }
    const userId = userRecord.uid;
    
    // 3. Clear any pre-existing data for this user to ensure a clean slate
    await deleteExistingData(userId, db);

    const batch = db.batch();
    console.log('[SEEDER] Preparing to commit creation batch...');
    // 4. Create/Update User Document
    const userRef = db.collection('users').doc(userId);
    batch.set(userRef, {
        uid: userId,
        email: TARGET_USER_EMAIL,
        role: 'landlord',
        businessProfile: { businessName: 'Sample Holdings LLC' },
        billing: { subscriptionTier: 'pro', status: 'active' },
        metadata: { createdAt: new Date() }
    }, { merge: true });

    // 5. Create Bank Accounts
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
  
    // 6. Create Properties and Tenants
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

    // 7. Create Transactions
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
    createTx(creditCardAccountId, 'Amazon - Supplies', -75.50, '', {l0: 'OPERATING EXPENSE', l1: 'Office & Administrative (Business)', l2: 'Schedule C, Line 22 — Supplies', l3: 'Office Supplies'});
    createTx(creditCardAccountId, 'HEB Grocery', -124.30, '2024-02-14', '', {l0: 'EQUITY', l1: 'Owner / Shareholder Equity', l2: 'Owner Distributions', l3: 'Personal Groceries'});
    createTx(checkingAccountId, 'Online Payment to Amex', -500, '2024-02-28', '', {l0: 'ASSET', l1: 'Cash Movement', l2: 'Internal Transfer', l3: 'Credit Card Payment'});
  
    // --- 8. Create Operations Center Data ---
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
        tenantId: 'alice.j@example.com',
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

    // --- 9. Commit the batch ---
    await batch.commit();
    console.log('[SEEDER] Creation batch committed successfully.');

    return { success: true, message: `Successfully seeded data for ${TARGET_USER_EMAIL}.` };
}
