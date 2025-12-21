import { getFirestore } from 'firebase-admin/firestore';
import { getApps, initializeApp, App } from 'firebase-admin/app';
import { firebaseConfig } from '@/firebase/config'; // Import the client-side config

// This function ensures that the admin app is initialized only once.
function initializeAdminApp(): App {
  const apps = getApps();
  if (apps.length) {
    return apps[0] as App;
  }
  // If no app is initialized, initialize it with the explicit storageBucket URL.
  return initializeApp({
    storageBucket: firebaseConfig.storageBucket
  });
}

const adminApp = initializeAdminApp();
const db = getFirestore(adminApp);

export { db, adminApp };
