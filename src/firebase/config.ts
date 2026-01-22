
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: "studio-7576922301-bac28.firebasestorage.app",
};

// Build-time sanity check to ensure essential variables are present.
// This prevents deploying a broken application.
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  throw new Error("CRITICAL: Missing NEXT_PUBLIC_FIREBASE_API_KEY or NEXT_PUBLIC_FIREBASE_PROJECT_ID. Check apphosting.yaml configuration.");
}

export { firebaseConfig };
