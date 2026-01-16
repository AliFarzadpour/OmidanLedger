import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

function initAdmin() {
  if (getApps().length) {
    return;
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (!raw) {
    // This warning is useful for local development but in production, we expect the key to be present.
    // The build will succeed, but the app will fail at runtime if the key is missing.
    console.warn("Firebase Admin SDK not initialized: FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set.");
    return; 
  }

  try {
    // The replace call is crucial for handling multi-line keys stored in a single line env var.
    const serviceAccount = JSON.parse(raw.replace(/\\n/g, '\n'));
    
    initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    });
  } catch (error: any) {
    console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:", error);
    // Throw a more informative error to make debugging easier.
    throw new Error(`FIREBASE_SERVICE_ACCOUNT_KEY is malformed. Please ensure it's a valid JSON string. Error: ${error.message}`);
  }
}

initAdmin();

export const db = getFirestore();
export const storage = getStorage();
