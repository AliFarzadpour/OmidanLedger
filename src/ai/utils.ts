// This file is now updated to use the Admin SDK for server-side operations.
import { db as adminDb } from '@/lib/firebase-admin';
import { Firestore, collection, getDocs, query } from 'firebase/firestore';

// This function now returns the admin Firestore instance.
export function initializeServerFirebase() {
  return {
    firestore: adminDb,
  };
}

export async function getUserCategoryMappings(firestore: Firestore, userId: string): Promise<string> {
    const mappingsQuery = query(collection(firestore, `users/${userId}/categoryMappings`));
    const snapshot = await getDocs(mappingsQuery);
    if (snapshot.empty) {
        return "No custom mappings provided.";
    }
    const mappings = snapshot.docs.map(doc => {
        const data = doc.data();
        return `- If the transaction description contains "${data.transactionDescription}", you MUST categorize it as: ${data.primaryCategory} > ${data.secondaryCategory} > ${data.subcategory}`;
    });
    return mappings.join('\n');
}
