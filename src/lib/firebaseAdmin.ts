
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import * as fs from 'fs';
import * as path from 'path';

function initAdmin() {
  if (getApps().length) {
    return;
  }

  // Path to the service account key file in the project root
  const serviceAccountPath = path.join(process.cwd(), 'service-account.json');

  try {
    // Check if the file exists before trying to read it
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccountString = fs.readFileSync(serviceAccountPath, 'utf8');
      const serviceAccount = JSON.parse(serviceAccountString);

      // Get storage bucket name from environment variables
      const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
      
      initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id,
        storageBucket: bucketName
      });
    } else {
        // If the file is not found, we fall back to the environment variable.
        const rawEnvVar = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
        if (rawEnvVar) {
            const serviceAccount = JSON.parse(rawEnvVar.replace(/\\n/g, '\n'));
            const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
            initializeApp({
                credential: cert(serviceAccount),
                projectId: serviceAccount.project_id,
                storageBucket: bucketName
            });
        } else {
            console.warn("Firebase Admin SDK not initialized: service-account.json not found and FIREBASE_SERVICE_ACCOUNT_KEY is not set.");
        }
    }
  } catch (error: any) {
    console.error("Failed to parse service-account.json or initialize Firebase Admin SDK:", error);
    throw new Error(`Could not initialize Firebase Admin. Please ensure service-account.json is valid. Error: ${error.message}`);
  }
}

initAdmin();

export const db = getFirestore();
export const storage = getStorage();
