'use server';
import admin from 'firebase-admin';
import { getApps } from 'firebase-admin/app';

function initializeAdminApp() {
  if (getApps().length > 0) {
    return admin.app();
  }

  // Correctly remove the 'gs://' prefix from the bucket name
  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.replace('gs://', '') || '';

  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
    storageBucket: bucketName,
  });
}

const adminApp = initializeAdminApp();
const db = admin.firestore(adminApp);
const storage = admin.storage(adminApp);

export { db, storage, adminApp as admin };
