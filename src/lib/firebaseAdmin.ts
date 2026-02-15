
'use server-only';

import admin from 'firebase-admin';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import fs from 'node:fs';
import path from 'node:path';

type ServiceAccount = {
  project_id?: string;
  private_key?: string;
  client_email?: string;
};

function normalizePrivateKey(key: string) {
  return key.replace(/\\n/g, '\n').replace(/\r/g, '').trim();
}

function loadServiceAccountFromB64(): ServiceAccount | null {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64;
  if (!b64 || !b64.trim()) return null;

  let raw: string;
  try {
    raw = Buffer.from(b64, 'base64').toString('utf8');
  } catch (err: any) {
    throw new Error(`Failed to base64-decode FIREBASE_SERVICE_ACCOUNT_KEY_B64: ${err?.message || err}`);
  }

  try {
    const sa = JSON.parse(raw) as ServiceAccount;
    if (sa.private_key) sa.private_key = normalizePrivateKey(sa.private_key);
    return sa;
  } catch (err: any) {
    throw new Error(`Failed to parse decoded FIREBASE_SERVICE_ACCOUNT_KEY_B64 JSON: ${err?.message || err}`);
  }
}

function loadServiceAccountFromLocalFile(): ServiceAccount | null {
  const p = path.join(process.cwd(), '.secrets', 'firebase-service-account.json');
  if (!fs.existsSync(p)) return null;

  try {
    const raw = fs.readFileSync(p, 'utf8');
    const sa = JSON.parse(raw) as ServiceAccount;
    if (sa.private_key) sa.private_key = normalizePrivateKey(sa.private_key);
    return sa;
  } catch (err: any) {
    throw new Error(`Failed to read/parse ${p}. Is it valid JSON? ${err?.message || err}`);
  }
}

function getServiceAccount(): ServiceAccount {
  const fromB64 = loadServiceAccountFromB64();
  if (fromB64) return fromB64;

  const fromFile = loadServiceAccountFromLocalFile();
  if (fromFile) return fromFile;

  throw new Error(
    'CRITICAL: Missing FIREBASE_SERVICE_ACCOUNT_KEY_B64. ' +
      'For production: add it as an App Hosting secret. ' +
      'For dev: create .secrets/firebase-service-account.json with a real Firebase Admin SDK key.'
  );
}

function ensureAdminInitialized() {
  if (getApps().length) return;

  const serviceAccount = getServiceAccount();

  if (!serviceAccount.project_id) throw new Error('Firebase Admin service account missing project_id.');
  if (!serviceAccount.client_email) throw new Error('Firebase Admin service account missing client_email.');
  if (!serviceAccount.private_key) throw new Error('Firebase Admin service account missing private_key.');

  // IMPORTANT: Use a SERVER env var, not NEXT_PUBLIC_*
  const bucketName = (process.env.FIREBASE_STORAGE_BUCKET || '')
    .replace('gs://', '')
    .trim();

  if (!bucketName) {
    throw new Error(
      'CRITICAL: Missing FIREBASE_STORAGE_BUCKET. ' +
        'Set FIREBASE_STORAGE_BUCKET to: studio-7576922301-bac28.firebasestorage.app'
    );
  }

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
