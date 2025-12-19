import { getFirestore } from 'firebase-admin/firestore';
import { getApps, initializeApp, App } from 'firebase-admin/app';

// This function ensures that the admin app is initialized only once.
function initializeAdminApp(): App {
  const apps = getApps();
  if (apps.length) {
    return apps[0] as App;
  }
  // If no app is initialized, it will use Application Default Credentials
  // in the App Hosting environment.
  return initializeApp();
}

const adminApp = initializeAdminApp();
const db = getFirestore(adminApp);

export { db, adminApp };
