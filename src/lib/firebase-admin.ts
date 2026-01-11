import 'server-only';
import { getApps, initializeApp, cert, getApp, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// 1. Helper to safely parse the JSON key without crashing the build
function getServiceAccount() {
  try {
    const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (key) {
      // If the key has single quotes or other issues, this might throw, 
      // but we catch it so the build doesn't crash.
      return JSON.parse(key);
    }
  } catch (error) {
    console.warn("⚠️ Could not parse FIREBASE_SERVICE_ACCOUNT_KEY during build. This is expected if the key is not set yet.");
    return null;
  }
  return null;
}

// 2. Initialize the Admin App safely
function createAdminApp(): App {
  const apps = getApps();
  if (apps.length > 0) {
    return apps[0];
  }

  const serviceAccount = getServiceAccount();

  if (serviceAccount) {
    return initializeApp({
      credential: cert(serviceAccount),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
  }

  // Fallback: If no service account (e.g. during build), try to return an existing app
  // or throw a helpful error ONLY at runtime, not build time.
  if (apps.length > 0) return apps[0];
  
  // If we are in production runtime and really need it, we fallback to standard init
  // which might pick up Google Cloud's default credentials automatically.
  return initializeApp({
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

// 3. Export the singleton instances
const admin = createAdminApp();
const db = getFirestore(admin);

export { db, admin };