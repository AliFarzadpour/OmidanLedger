
'use server-only';

import admin from 'firebase-admin';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

type ServiceAccount = {
  project_id?: string;
  private_key?: string;
  client_email?: string;
};

function normalizePrivateKey(key: string): string {
    return key.replace(/\\n/g, '\n');
}

function getServiceAccount(): ServiceAccount {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64;
  if (!b64 || !b64.trim()) {
    throw new Error('CRITICAL: Missing FIREBASE_SERVICE_ACCOUNT_KEY_B64 environment variable.');
  }

  let raw: string;
  try {
    raw = Buffer.from(b64, 'base64').toString('utf8');
  } catch (err: any) {
    throw new Error(`Failed to base64-decode FIREBASE_SERVICE_ACCOUNT_KEY_B64: ${err?.message || err}`);
  }

  try {
    const sa = JSON.parse(raw) as ServiceAccount;
    if (sa.private_key) {
      sa.private_key = normalizePrivateKey(sa.private_key);
    }
    return sa;
  } catch (err: any) {
    throw new Error(`Failed to parse decoded FIREBASE_SERVICE_ACCOUNT_KEY_B64 JSON: ${err?.message || err}`);
  }
}

function ensureAdminInitialized() {
  if (getApps().length > 0) {
    return;
  }

  const serviceAccount = getServiceAccount();

  if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error('Firebase Admin service account is missing required fields (project_id, client_email, private_key).');
  }

  const bucketName = process.env.FIREBASE_STORAGE_BUCKET || 'studio-7576922301-bac28.firebasestorage.app';

  initializeApp({
    credential: cert(serviceAccount as any),
    projectId: serviceAccount.project_id,
    storageBucket: bucketName,
  });
}

export function getAdminDb() {
  ensureAdminInitialized();
  return getFirestore();
}

export function getAdminAuth() {
  ensureAdminInitialized();
  return getAuth();
}

export function getAdminStorage() {
  ensureAdminInitialized();
  return getStorage();
}
