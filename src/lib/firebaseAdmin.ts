// src/lib/firebaseAdmin.ts
import 'server-only';

import fs from 'node:fs';
import path from 'node:path';

import { getApps, initializeApp, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage, type Storage } from 'firebase-admin/storage';

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
  [key: string]: any;
};

declare global {
  // eslint-disable-next-line no-var
  var __ADMIN_APP__: App | undefined;
  // eslint-disable-next-line no-var
  var __ADMIN_DB__: Firestore | undefined;
  // eslint-disable-next-line no-var
  var __ADMIN_STORAGE__: Storage | undefined;
}

function normalizePrivateKey(sa: any) {
  if (sa && typeof sa.private_key === 'string') {
    sa.private_key = sa.private_key.replace(/\\n/g, '\n');
  }
  return sa;
}

function loadFromB64(): ServiceAccount | null {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64;
  if (!b64 || !b64.trim()) return null;

  const jsonText = Buffer.from(b64.trim(), 'base64').toString('utf8');
  const sa = normalizePrivateKey(JSON.parse(jsonText));

  if (!sa.project_id || !sa.client_email || !sa.private_key) {
    throw new Error(
      'Service account JSON (from FIREBASE_SERVICE_ACCOUNT_KEY_B64) missing required fields.'
    );
  }
  return sa;
}

function loadFromFileIfDev(): ServiceAccount | null {
  // Only allow file fallback in dev/studio/local
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) return null;

  // 1) If GOOGLE_APPLICATION_CREDENTIALS is set, use it
  const gac = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (gac && fs.existsSync(gac)) {
    const sa = normalizePrivateKey(JSON.parse(fs.readFileSync(gac, 'utf8')));
    if (!sa.project_id || !sa.client_email || !sa.private_key) {
      throw new Error(
        'Service account JSON (from GOOGLE_APPLICATION_CREDENTIALS) missing required fields.'
      );
    }
    return sa;
  }

  // 2) Otherwise use repo-local path
  const localPath = path.join(process.cwd(), '.secrets', 'firebase-service-account.json');
  if (!fs.existsSync(localPath)) return null;

  const sa = normalizePrivateKey(JSON.parse(fs.readFileSync(localPath, 'utf8')));
  if (!sa.project_id || !sa.client_email || !sa.private_key) {
    throw new Error('Local service account file missing required fields.');
  }
  return sa;
}

function loadServiceAccount(): ServiceAccount {
  // Prefer production secret (B64)
  const fromB64 = loadFromB64();
  if (fromB64) return fromB64;

  // Dev fallback: local file
  const fromFile = loadFromFileIfDev();
  if (fromFile) return fromFile;

  // If we got here, we truly don't have credentials
  throw new Error(
    'CRITICAL: Missing FIREBASE_SERVICE_ACCOUNT_KEY_B64. ' +
      'In production, add it as an App Hosting secret (BUILD+RUNTIME). ' +
      'In development, create .secrets/firebase-service-account.json (dev only) or set GOOGLE_APPLICATION_CREDENTIALS.'
  );
}

function ensureAdminInitialized(): App {
  if (getApps().length > 0) return getApps()[0];
  if (global.__ADMIN_APP__) return global.__ADMIN_APP__;

  const serviceAccount = loadServiceAccount();

  const app = initializeApp({
    credential: cert(serviceAccount as any),
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
