
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

function initAdmin() {
  if (getApps().length) return;

  let raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (!raw) {
    console.warn("Missing FIREBASE_SERVICE_ACCOUNT_KEY environment variable.");
    return;
  }

  // Sanitize the input: handle escaped newlines often found in .env values
  raw = raw.replace(/\\n/g, '\n');

  try {
    const serviceAccount = JSON.parse(raw);
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    
    initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id,
      storageBucket: bucketName
    });
  } catch (error: any) {
    console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:", error);

    // Provide a helpful hint based on the specific error
    let hint = "Check your .env file.";
    if (error instanceof SyntaxError && error.message.includes("position 1")) {
      hint = "The JSON likely starts with a single quote (') instead of a double quote (\") or has single-quoted keys.";
    }

    throw new Error(`FIREBASE_SERVICE_ACCOUNT_KEY is malformed. ${hint} Error: ${error.message}`);
  }
}

initAdmin();

export const db = getFirestore();
export const storage = getStorage();
