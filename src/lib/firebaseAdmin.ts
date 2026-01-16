// src/lib/firebaseAdmin.ts
import { getApps, initializeApp, cert, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getStorage, Storage } from 'firebase-admin/storage';

function loadServiceAccount() {
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

  throw new Error(
    "Missing FIREBASE_SERVICE_ACCOUNT_KEY_B64 or FIREBASE_SERVICE_ACCOUNT_KEY in environment."
  );
}

let adminApp: App;
let _db: Firestore | null = null;
let _storage: Storage | null = null;

function initializeAdmin() {
  if (getApps().length === 0) {
    const serviceAccount = loadServiceAccount();
    adminApp = initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
  } else {
    adminApp = getApps()[0];
  }
}

export function getAdminDb(): Firestore {
  if (!_db) {
    if (getApps().length === 0) {
      initializeAdmin();
    }
    _db = getFirestore();
  }
  return _db;
}

export function getAdminStorage(): Storage {
  if (!_storage) {
    if (getApps().length === 0) {
      initializeAdmin();
    }
    _storage = getStorage();
  }
  return _storage;
}
