// src/lib/firebaseAdmin.ts
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getStorage, Storage } from "firebase-admin/storage";
import fs from "fs";

function loadServiceAccount() {
  // ✅ Prod/App Hosting path (Secret Manager)
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64;
  if (b64 && b64.trim()) {
    try {
      const json = Buffer.from(b64, "base64").toString("utf8");
      return JSON.parse(json);
    } catch (err: any) {
      throw new Error(
        `CRITICAL: FIREBASE_SERVICE_ACCOUNT_KEY_B64 is not valid base64-encoded JSON. ${err?.message || err}`
      );
    }
  }

  // ✅ Dev fallback (local file)
  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (filePath && filePath.trim()) {
    try {
      const json = fs.readFileSync(filePath, "utf8");
      return JSON.parse(json);
    } catch (err: any) {
      throw new Error(
        `CRITICAL: Failed to read FIREBASE_SERVICE_ACCOUNT_PATH "${filePath}". ${err?.message || err}`
      );
    }
  }

  // ✅ Helpful message that explains the difference
  throw new Error(
    "CRITICAL: Missing Firebase Admin credentials. In production set FIREBASE_SERVICE_ACCOUNT_KEY_B64 (App Hosting secret). In development set FIREBASE_SERVICE_ACCOUNT_PATH to a local service account JSON file."
  );
}

function ensureAdminInitialized() {
  if (getApps().length) return;

  const serviceAccount = loadServiceAccount();
  
  // FIX: Explicitly replace escaped newlines in the private key string
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }

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
