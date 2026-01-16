// src/lib/firebaseAdmin.ts
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getStorage, Storage } from "firebase-admin/storage";

function loadServiceAccountFromB64() {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64;

  if (!b64 || !b64.trim()) {
    throw new Error(
      "CRITICAL: Missing FIREBASE_SERVICE_ACCOUNT_KEY_B64. Add it as an App Hosting secret (BUILD + RUNTIME)."
    );
  }

  try {
    const json = Buffer.from(b64, "base64").toString("utf8");
    return JSON.parse(json);
  } catch (err: any) {
    throw new Error(
      `CRITICAL: FIREBASE_SERVICE_ACCOUNT_KEY_B64 is not valid base64-encoded JSON. ${err?.message || err}`
    );
  }
}

function ensureAdminInitialized() {
  if (getApps().length) return;

  const serviceAccount = loadServiceAccountFromB64();

  initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
}

let _db: Firestore | null = null;
let _storage: Storage | null = null;

export function getAdminDb(): Firestore {
  if (_db) return _db;
  ensureAdminInitialized();
  _db = getFirestore();
  return _db;
}

export function getAdminStorage(): Storage {
  if (_storage) return _storage;
  ensureAdminInitialized();
  _storage = getStorage();
  return _storage;
}

