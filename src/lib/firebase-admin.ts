// src/lib/firebase-admin.ts
import admin from 'firebase-admin';
import { getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// A server-only utility to securely initialize the Firebase Admin SDK.

const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (!serviceAccountKey) {
  throw new Error(
    'FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set. Please add it to your .env.local file.'
  );
}

let serviceAccount;
try {
  // The service account key is stored as a JSON string in the environment variable.
  // We need to parse it to get the object.
  serviceAccount = JSON.parse(serviceAccountKey);
} catch (error) {
  console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', error);
  throw new Error(
    'Failed to parse the service account key. Ensure it is a valid JSON string.'
  );
}

// Singleton Pattern: Initialize the app only if it hasn't been already.
// This is crucial for Next.js hot-reloading environments to avoid crashes.
if (!getApps().length) {
  admin.initializeApp({
    credential: cert(serviceAccount),
  });
}

// Export the initialized Firestore database instance for use in server-side code.
const db = getFirestore();

export { db, admin };
