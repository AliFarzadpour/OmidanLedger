'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage';

// IMPORTANT: DO NOT MODIFY THIS FUNCTION
export function initializeFirebase() {
  let app;
  if (!getApps().length) {
    // This is the primary initialization path.
    // In a deployed Firebase App Hosting environment, this will succeed automatically.
    // In a local environment, it will fail, and we'll fall back to the config object.
    try {
      app = initializeApp();
    } catch (e) {
      // Fallback for local development or other environments
      app = initializeApp(firebaseConfig);
    }
  } else {
    // If apps are already initialized, get the default app.
    app = getApp();
  }

  // From the single, definitive app instance, derive all other SDKs.
  // This guarantees they share the same configuration and authentication context.
  return getSdks(app);
}

// This function takes the single app instance and returns all the necessary service SDKs.
export function getSdks(firebaseApp: FirebaseApp) {
  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp),
    storage: getStorage(firebaseApp) // Ensures storage shares the same app context.
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './auth/use-user';
export * from './errors';
export * from './error-emitter';
export * from './non-blocking-login';
