import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function initAdmin() {
  if (getApps().length) return;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (!raw) {
    throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_KEY (dev) — set it in .env.local");
  }

  const serviceAccount = JSON.parse(raw);

  initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.project_id, // ensures correct project
  });
}

initAdmin();

export const db = getFirestore();
