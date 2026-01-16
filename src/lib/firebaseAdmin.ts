import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

function initAdmin() {
  if (getApps().length) return;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (!raw) {
    // In dev, we might not have the key set yet, or it might be in .env.local
    console.warn("Missing FIREBASE_SERVICE_ACCOUNT_KEY environment variable.");
    return; 
  }

  try {
    const serviceAccount = JSON.parse(raw);
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id,
      storageBucket: bucketName
    });
  } catch (error: any) {
    console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:", error);
    // Throwing a clearer error helps you confirm if the issue is the variable itself
    throw new Error(`FIREBASE_SERVICE_ACCOUNT_KEY is malformed or invalid JSON. Check your .env file. Error: ${error.message}`);
  }
}

initAdmin();

export const db = getFirestore();
export const storage = getStorage();
