// src/lib/firebase-admin.ts
import admin from 'firebase-admin';
import { getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// A server-only utility to securely initialize the Firebase Admin SDK.
// This version uses Application Default Credentials and does not require
// a manual service account key in environment variables.

// Singleton Pattern: Initialize the app only if it hasn't been already.
// This is crucial for Next.js hot-reloading environments to avoid crashes.
if (!getApps().length) {
  // By initializing without arguments, the Admin SDK will automatically
  // use the Application Default Credentials available in the App Hosting environment.
  admin.initializeApp();
}

// Export the initialized Firestore database instance for use in server-side code.
const db = getFirestore();

export { db, admin };
