import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

function initAdmin() {
  if (getApps().length) return;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (!raw) {
    throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_KEY (dev) — set it in .env.local");
  }

  const serviceAccount = JSON.parse(raw);
  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.project_id, // ensures correct project
    storageBucket: bucketName
  });
}

initAdmin();

export const db = getFirestore();
export const storage = getStorage();
