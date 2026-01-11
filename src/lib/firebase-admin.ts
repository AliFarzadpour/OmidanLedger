import admin from 'firebase-admin';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// 1. You must add FIREBASE_SERVICE_ACCOUNT_KEY to your .env.local
// This should be the JSON string from your Firebase Settings -> Service Accounts
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  });
}

const db = getFirestore();

export { db, admin };
