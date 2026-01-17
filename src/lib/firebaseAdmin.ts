
'use server';

import 'server-only';

import { getApps, initializeApp, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage, type Storage } from 'firebase-admin/storage';

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

function decodeServiceAccountFromB64(): ServiceAccount {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64;

  if (!b64 || !b64.trim()) {
    throw new Error(
      'CRITICAL: Missing FIREBASE_SERVICE_ACCOUNT_KEY_B64. Add it as an App Hosting secret (RUNTIME).'
    );
  }

  let jsonText: string;
  try {
    jsonText = Buffer.from(b64.trim(), 'base64').toString('utf8');
  } catch (e: any) {
    throw new Error(
      `Failed to base64-decode FIREBASE_SERVICE_ACCOUNT_KEY_B64: ${e?.message || e}`
    );
  }

  let sa: ServiceAccount;
  try {
    sa = JSON.parse(jsonText);
  } catch (e: any) {
    throw new Error(
      `FIREBASE_SERVICE_ACCOUNT_KEY_B64 did not decode into valid JSON. ${e?.message || e}`
    );
  }

  // Normalize private key formatting (fixes "Invalid PEM formatted message")
  if (typeof sa.private_key === 'string') {
    sa.private_key = sa.private_key.replace(/\\n/g, '\n');
  }

  // Basic validation
  if (!sa.project_id || !sa.client_email || !sa.private_key) {
    throw new Error(
      'Service account JSON is missing required fields (project_id, client_email, private_key).'
    );
  }

  if (!sa.private_key.includes('BEGIN PRIVATE KEY')) {
    throw new Error(
      'Failed to parse private key: private_key is not a valid PEM. Check that the secret value is the BASE64 of the full service account JSON file.'
    );
  }

  return sa;
}

function ensureAdminInitialized(): App {
  // If Firebase already has an app (rare in App Hosting), reuse it
  if (getApps().length > 0) return getApps()[0];

  // Our own cached singleton
  if (global.__ADMIN_APP__) return global.__ADMIN_APP__;

  const serviceAccount = decodeServiceAccountFromB64();

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
