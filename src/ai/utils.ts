// This file is now updated to use the Admin SDK for server-side operations.
import { db as adminDb } from '@/lib/firebase-admin';
import { Firestore } from 'firebase-admin/firestore';


// This function now returns the admin Firestore instance.
export function initializeServerFirebase() {
  return {
    firestore: adminDb,
  };
}

export async function getUserCategoryMappings(firestore: Firestore, userId: string): Promise<string> {
    const mappingsSnapshot = await firestore.collection(`users/${userId}/categoryMappings`).get();
    if (mappingsSnapshot.empty) {
        return "No custom mappings provided.";
    }
    const mappings = mappingsSnapshot.docs.map(doc => {
        const data = doc.data();
        return `- If the transaction description contains "${data.transactionDescription}", you MUST categorize it as: ${data.primaryCategory} > ${data.secondaryCategory} > ${data.subcategory}`;
    });
    return mappings.join('\n');
}
