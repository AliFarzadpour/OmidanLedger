// This file is NOT a "use server" file. It's a server-side utility.
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getApps, initializeApp, App, cert } from 'firebase-admin/app';

// This function ensures that the admin app is initialized only once.
function initializeAdminApp(): App {
  const apps = getApps();
  if (apps.length > 0) {
    return apps[0];
  }

  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (!serviceAccountKey) {
    // If running in a production environment (like App Hosting) and credentials aren't fully set,
    // Google's infrastructure often provides default credentials automatically.
    // Using initializeApp() without arguments leverages this.
    console.log("Attempting to initialize Admin App with default credentials...");
    return initializeApp({
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
  }

  try {
    // Correctly parse the JSON string and replace escaped newlines in the private key.
    const serviceAccount = JSON.parse(serviceAccountKey);
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }

    return initializeApp({
      credential: cert(serviceAccount),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    });
  } catch (e) {
    console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY. Ensure it is a valid JSON string.", e);
    // Fallback if parsing fails
    return initializeApp();
  }
}

const adminApp = initializeAdminApp();
const db = getFirestore(adminApp);
const storage = getStorage(adminApp);

export { db, adminApp, storage };
