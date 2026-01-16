// src/lib/firebaseAdmin.ts
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

function loadServiceAccount() {
  // Preferred: Base64-encoded JSON (safe across environments)
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64;
  if (b64 && b64.trim().length > 0) {
    try {
      const json = Buffer.from(b64, "base64").toString("utf8");
      return JSON.parse(json);
    } catch (err: any) {
      throw new Error(
        `Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY_B64 (base64). ${err?.message || err}`
      );
    }
  }

  // Fallback: raw JSON string (your older secret)
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (raw && raw.trim().length > 0) {
    try {
      return JSON.parse(raw);
    } catch (err: any) {
      throw new Error(
        `Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY. Is it valid JSON? ${err?.message || err}`
      );
    }
  }

  // This check will only fail at runtime if no key is present, allowing the build to pass.
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      "CRITICAL: Missing FIREBASE_SERVICE_ACCOUNT_KEY_B64 or FIREBASE_SERVICE_ACCOUNT_KEY in production environment."
    );
  } else {
    // In development or build, we might not have the key. Return a dummy object to allow build to pass.
    // The functions will fail at runtime if they are called without a real key.
    console.warn("Firebase Admin SDK running in mock mode. Real credentials are required for backend operations.");
    return { projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'dummy-project' };
  }
}

// Initialize once per runtime
if (!getApps().length) {
    try {
        const serviceAccount = loadServiceAccount();
        initializeApp({
            credential: cert(serviceAccount),
            projectId: serviceAccount.projectId, 
            storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        });
    } catch (e) {
        console.warn(`Firebase Admin initialization failed: ${(e as Error).message}. Backend features will be unavailable.`);
    }
}

// These will now safely export, and will only fail at runtime if initialization failed.
export const db = getFirestore();
export const storage = getStorage();
