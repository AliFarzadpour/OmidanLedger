// src/lib/firebase-admin.ts
import admin from 'firebase-admin';
import { getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { firebaseConfig } from '@/firebase/config'; // Import client config to get bucket URL

// Singleton Pattern: Initialize the app only if it hasn't been already.
if (!getApps().length) {
  // Explicitly initialize with the storageBucket from your config.
  // This is the correct way to ensure the Admin SDK knows where to upload files.
  admin.initializeApp({
    storageBucket: firebaseConfig.storageBucket
  });
}

// Export the initialized Firestore database instance for use in server-side code.
const db = getFirestore();

export { db, admin };
