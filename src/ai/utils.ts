import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, collection, getDocs, query, where } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';

// This is a server-only Firebase initialization function.
// It is safe to be called from Server Components and Genkit flows.
export function initializeServerFirebase() {
  if (!getApps().length) {
    let firebaseApp;
    try {
      // Attempt to initialize via Firebase App Hosting environment variables
      firebaseApp = initializeApp();
    } catch (e) {
      // Only warn in production because it's normal to use the firebaseConfig to initialize
      // during development when not in a deployed environment.
      if (process.env.NODE_ENV === "production") {
        console.warn('Automatic server initialization failed. Falling back to firebase config object.', e);
      }
      firebaseApp = initializeApp(firebaseConfig);
    }
    return getSdks(firebaseApp);
  }

  // If already initialized, return the SDKs with the already initialized App
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
