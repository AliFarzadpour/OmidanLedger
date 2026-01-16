
'use server';

import { db } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

async function deleteCollection(collectionPath: string, batch: FirebaseFirestore.WriteBatch) {
    const collectionRef = db.collection(collectionPath);
    const snapshot = await collectionRef.get();

    if (snapshot.size === 0) {
        return;
    }

    snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
    });
}


export async function deleteAllUserData(userId: string) {
    if (!userId) {
        throw new Error("User ID is required.");
    }
    
    const batch = db.batch();

    try {
        // --- 1. Delete top-level collections owned by the user ---
        const userCollections = ['vendors', 'invoices', 'bills'];
        for (const collectionName of userCollections) {
            const snapshot = await db.collection(collectionName).where('userId', '==', userId).get();
            snapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
        }
        
        // --- 2. Deep delete properties and their subcollections ---
        const propertiesSnap = await db.collection('properties').where('userId', '==', userId).get();
        for (const propDoc of propertiesSnap.docs) {
            // Delete subcollections of the property first
            await deleteCollection(propDoc.ref.collection('units').path, batch);
            await deleteCollection(propDoc.ref.collection('documents').path, batch);
            await deleteCollection(propDoc.ref.collection('monthlyStats').path, batch);
            
            // Now, delete the property document itself
            batch.delete(propDoc.ref);
        }

        // --- 3. Deep delete bank accounts and their subcollections ---
        const bankAccountsSnap = await db.collection('users').doc(userId).collection('bankAccounts').get();
        for (const accountDoc of bankAccountsSnap.docs) {
            await deleteCollection(accountDoc.ref.collection('transactions').path, batch);
            batch.delete(accountDoc.ref);
        }

        // --- 4. Delete other user subcollections ---
        await deleteCollection(db.collection('users').doc(userId).collection('categoryMappings').path, batch);
        await deleteCollection(db.collection('users').doc(userId).collection('admin_invoices').path, batch);
        await deleteCollection(db.collection('users').doc(userId).collection('charges').path, batch);

        // --- 5. Finally, delete the user document itself ---
        batch.delete(db.collection('users').doc(userId));

        // --- 6. Commit all the deletions atomically ---
        await batch.commit();

        return { success: true, message: "All user data has been deleted." };
    } catch (error: any) {
        console.error("Error deleting user data:", error);
        throw new Error("Failed to delete user data: " + error.message);
    }
}

    
