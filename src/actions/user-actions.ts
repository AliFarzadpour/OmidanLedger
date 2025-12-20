'use server';

import { db } from '@/lib/admin-db';
import { FieldValue } from 'firebase-admin/firestore';

async function deleteCollection(collectionPath: string, batchSize: number, batch: FirebaseFirestore.WriteBatch) {
    const collectionRef = db.collection(collectionPath);
    const query = collectionRef.limit(batchSize);

    return new Promise((resolve, reject) => {
        deleteQueryBatch(query, batch, resolve, reject);
    });
}

async function deleteQueryBatch(
    query: FirebaseFirestore.Query, 
    batch: FirebaseFirestore.WriteBatch, 
    resolve: (value: unknown) => void, 
    reject: (reason?: any) => void
) {
    try {
        const snapshot = await query.get();
        const batchSize = snapshot.size;

        if (batchSize === 0) {
            resolve(true);
            return;
        }

        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });

        // Recurse on the next process tick, to avoid hitting stack size limits
        process.nextTick(() => {
            deleteQueryBatch(query, batch, resolve, reject);
        });

    } catch(e) {
        reject(e);
    }
}


export async function deleteAllUserData(userId: string) {
    if (!userId) {
        throw new Error("User ID is required.");
    }
    
    const batch = db.batch();

    try {
        // Collections to delete based on userId field
        const userCollections = ['properties', 'vendors', 'invoices', 'bills'];
        for (const collectionName of userCollections) {
            const snapshot = await db.collection(collectionName).where('userId', '==', userId).get();
            snapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
        }
        
        // --- Delete Subcollections of User ---
        const bankAccountsSnap = await db.collection('users').doc(userId).collection('bankAccounts').get();
        for (const accountDoc of bankAccountsSnap.docs) {
            // Delete transactions within each bank account
            const transactionsSnap = await accountDoc.ref.collection('transactions').get();
            transactionsSnap.forEach(txDoc => batch.delete(txDoc.ref));
            // Delete the bank account itself
            batch.delete(accountDoc.ref);
        }

        const categoryMappingsSnap = await db.collection('users').doc(userId).collection('categoryMappings').get();
        categoryMappingsSnap.forEach(doc => batch.delete(doc.ref));

        // Finally, delete the user document itself
        batch.delete(db.collection('users').doc(userId));

        // Commit all the deletions
        await batch.commit();

        return { success: true, message: "All user data has been deleted." };
    } catch (error: any) {
        console.error("Error deleting user data:", error);
        throw new Error("Failed to delete user data: " + error.message);
    }
}
