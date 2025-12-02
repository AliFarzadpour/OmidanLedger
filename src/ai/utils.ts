'use server';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

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
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp)
  };
}


export async function getUserCategoryMappings(firestore: any, userId: string): Promise<string> {
    if (!firestore || !userId) {
        return "No custom mappings provided.";
    }
    const mappingsSnapshot = await getDocs(collection(firestore, `users/${userId}/categoryMappings`));
    if (mappingsSnapshot.empty) {
        return "No custom mappings provided.";
    }
    const mappings = mappingsSnapshot.docs.map(doc => {
        const data = doc.data();
        return `- Description: "${data.transactionDescription}" -> Category: ${data.primaryCategory} > ${data.secondaryCategory} > ${data.subcategory}`;
    });
    return mappings.join('\n');
}
