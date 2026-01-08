
import { getFirestore } from 'firebase-admin/firestore';
import { getApps, initializeApp, App, cert } from 'firebase-admin/app';

// This function ensures that the admin app is initialized only once.
function initializeAdminApp(): App {
  const apps = getApps();
  if (apps.length) {
    return apps[0] as App;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Replace escaped newlines in the private key
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
      throw new Error("Firebase Admin SDK configuration error: Missing required environment variables (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY).");
  }

  // If no app is initialized, initialize it with the explicit credentials.
  return initializeApp({
    credential: cert({
        projectId,
        clientEmail,
        privateKey,
    }),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  });
}

const adminApp = initializeAdminApp();
const db = getFirestore(adminApp);

export { db, adminApp };

