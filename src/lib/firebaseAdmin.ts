
import admin from 'firebase-admin';

// This function will be called only when db or storage are first accessed.
function getAdminApp() {
  // If already initialized, return the app.
  if (admin.apps.length > 0 && admin.app()) {
    return admin.app();
  }

  // Get the service account key from environment variables.
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey) {
    // This will now only happen at runtime if the key is missing, causing a clear failure.
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not set in the environment.');
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountKey.replace(/\\n/g, '\n'));
    // Initialize the app and return it.
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
  } catch (error: any) {
    // This will catch a malformed key at runtime.
    throw new Error(`Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY. Is it valid JSON? Error: ${error.message}`);
  }
}

// We use a proxy to defer the initialization until the 'db' or 'storage' object is actually used.
// This allows the Next.js build process to succeed even if environment variables are not available.
const dbProxy = new Proxy({}, {
  get(target, prop) {
    const firestore = getAdminApp().firestore();
    return Reflect.get(firestore, prop);
  }
});

const storageProxy = new Proxy({}, {
  get(target, prop) {
    const storageService = getAdminApp().storage();
    return Reflect.get(storageService, prop);
  }
});

// Export the proxies. They will behave exactly like the real db and storage objects.
export const db = dbProxy as admin.firestore.Firestore;
export const storage = storageProxy as admin.storage.Storage;
