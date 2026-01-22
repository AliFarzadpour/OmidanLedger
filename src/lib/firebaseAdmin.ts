// src/lib/firebaseAdmin.ts
import 'server-only';

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import fs from 'node:fs';
import path from 'node:path';

type ServiceAccount = {
  type?: string;
  project_id?: string;
  private_key_id?: string;
  private_key?: string;
  client_email?: string;
  client_id?: string;
  auth_uri?: string;
  token_uri?: string;
  auth_provider_x509_cert_url?: string;
  client_x509_cert_url?: string;
  universe_domain?: string;
};

function normalizePrivateKey(key: string) {
  return key
    .replace(/\\n/g, '\n')
    .replace(/\r/g, '')
    .trim();
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
    throw new Error(
      `Failed to parse decoded FIREBASE_SERVICE_ACCOUNT_KEY_B64 JSON: ${err?.message || err}`
    );
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
    throw new Error(
      `Failed to read/parse ${p}. Is it valid JSON? ${err?.message || err}`
    );
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

  if (!serviceAccount.project_id) {
    throw new Error('Firebase Admin service account missing project_id.');
  }
  if (!serviceAccount.client_email) {
    throw new Error('Firebase Admin service account missing client_email.');
  }
  if (!serviceAccount.private_key) {
    throw new Error('Firebase Admin service account missing private_key.');
  }

  if (!serviceAccount.private_key.includes('BEGIN PRIVATE KEY')) {
    throw new Error('Firebase Admin private_key does not look like a PEM key (missing BEGIN PRIVATE KEY).');
  }

  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.replace('gs://', '');
  if (!bucketName) {
    throw new Error('CRITICAL: Missing NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET. Check apphosting.yaml configuration.');
  }


  try {
    initializeApp({
      credential: cert(serviceAccount as any),
      projectId: serviceAccount.project_id,
      storageBucket: bucketName,
    });
  } catch (err: any) {
    throw new Error(`Failed to parse private key: ${err?.message || err}`);
  }
}

export function getAdminDb() {
  ensureAdminInitialized();
  return getFirestore();
}

export function getAdminStorage() {
  ensureAdminInitialized();
  return getStorage();
}
