
import { getFirestore } from 'firebase-admin/firestore';
import { getApps, initializeApp, App, cert } from 'firebase-admin/app';

// This function ensures that the admin app is initialized only once.
function initializeAdminApp(): App {
  const apps = getApps();
  if (apps.length) {
    return apps[0] as App;
  }

  // Safely get credentials for the build environment
  let serviceAccount;
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    }
  } catch (e) {
    console.warn("Could not parse FIREBASE_SERVICE_ACCOUNT_KEY, falling back to other credentials.");
    serviceAccount = null;
  }
  
  if (!serviceAccount) {
    serviceAccount = {
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      };
  }
  
  // If running in a production environment (like App Hosting) and credentials aren't fully set,
  // Google's infrastructure often provides default credentials automatically.
  // Using initializeApp() without arguments leverages this.
  if (!serviceAccount.privateKey) {
      console.log("Attempting to initialize Admin App with default credentials...");
      return initializeApp({
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      });
  }

  return initializeApp({
    credential: cert(serviceAccount),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  });
}

const adminApp = initializeAdminApp();
const db = getFirestore(adminApp);

export { db, adminApp };
