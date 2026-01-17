// src/lib/firebaseAdmin.ts
import 'server-only';

import { getApps, initializeApp, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage, type Storage } from 'firebase-admin/storage';
import fs from 'fs';
import path from 'path';

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
  [key: string]: any;
};

// ---- Global singletons (prevents re-init across hot reload / multiple imports) ----
declare global {
  // eslint-disable-next-line no-var
  var __ADMIN_APP__: App | undefined;
  // eslint-disable-next-line no-var
  var __ADMIN_DB__: Firestore | undefined;
  // eslint-disable-next-line no-var
  var __ADMIN_STORAGE__: Storage | undefined;
}

function normalizePrivateKey(sa: ServiceAccount): ServiceAccount {
  if (sa.private_key) {
    sa.private_key = sa.private_key.replace(/\\n/g, '\n');
  }
  return sa;
}

function loadServiceAccount(): ServiceAccount {
  // ✅ Prod/App Hosting path (Secret Manager)
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64;
  if (b64 && b64.trim()) {
    try {
      const json = Buffer.from(b64, 'base64').toString('utf8');
      const serviceAccount = JSON.parse(json);
      return normalizePrivateKey(serviceAccount);
    } catch (err: any) {
      throw new Error(
        `CRITICAL: FIREBASE_SERVICE_ACCOUNT_KEY_B64 is not valid base64-encoded JSON. ${err?.message || err}`
      );
    }
  }

  // ✅ Dev fallback (local file)
  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (filePath && filePath.trim()) {
    const absolutePath = path.resolve(filePath);
    try {
      if (!fs.existsSync(absolutePath)) {
         throw new Error(`File not found at specified path: ${absolutePath}`);
      }
      const json = fs.readFileSync(absolutePath, 'utf8');
      const serviceAccount = JSON.parse(json);
      return normalizePrivateKey(serviceAccount);
    } catch (err: any) {
      throw new Error(
        `CRITICAL: Failed to read FIREBASE_SERVICE_ACCOUNT_PATH "${absolutePath}". ${err?.message || err}`
      );
    }
  }

  // ✅ Helpful message that explains the difference
  throw new Error(
    "CRITICAL: Missing Firebase Admin credentials. In production set FIREBASE_SERVICE_ACCOUNT_KEY_B64 (App Hosting secret). In development create service-account.json and set FIREBASE_SERVICE_ACCOUNT_PATH in .env.local."
  );
}


function ensureAdminInitialized(): App {
  if (getApps().length) return getApps()[0];
  if (global.__ADMIN_APP__) return global.__ADMIN_APP__;

  const serviceAccount = loadServiceAccount();

  const app = initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });

  global.__ADMIN_APP__ = app;
  return app;
}

export function getAdminDb(): Firestore {
  if (global.__ADMIN_DB__) return global.__ADMIN_DB__;
  const app = ensureAdminInitialized();
  const db = getFirestore(app);
  global.__ADMIN_DB__ = db;
  return db;
}

export function getAdminStorage(): Storage {
  if (global.__ADMIN_STORAGE__) return global.__ADMIN_STORAGE__;
  const app = ensureAdminInitialized();
  const storage = getStorage(app);
  global.__ADMIN_STORAGE__ = storage;
  return storage;
}
