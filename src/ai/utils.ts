import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, collection, getDocs, query } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';

// This is a server-only Firebase initialization function.
// It is safe to be called from Server Components and Genkit flows.
export function initializeServerFirebase() {
  if (!getApps().length) {
    const firebaseApp = initializeApp(firebaseConfig);
    return getSdks(firebaseApp);
  }
  return getSdks(getApp());
}

function getSdks(firebaseApp: FirebaseApp) {
  return {
    firebaseApp,
    firestore: getFirestore(firebaseApp)
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
