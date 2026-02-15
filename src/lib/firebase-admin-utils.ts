
'use server';
import admin from 'firebase-admin';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import 'dotenv/config'

function initializeAdminApp() {
  if (getApps().length > 0) {
    return admin.app();
  }

  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64;
  if (!b64) {
    console.log("B64 env var not found, trying Application Default Credentials.");
    return initializeApp();
  }
  
  const serviceAccount = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));

  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.replace('gs://', '') || '';

  return initializeApp({
    credential: cert(serviceAccount),
    storageBucket: bucketName,
  });
}

const adminApp = initializeAdminApp();

export function getAdminDb() {
    return getFirestore(adminApp);
}

export function getAdminAuth() {
    return getAuth(adminApp);
}

export function getAdminStorage() {
    return getStorage(adminApp);
}
