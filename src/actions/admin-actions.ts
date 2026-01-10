'use server';

import * as admin from '@/lib/firebase-admin';

export async function refreshGlobalSystemStats() {
  // Use the verified admin pattern
  const db = admin.db || (admin.admin && admin.admin.firestore());
  
  if (!db) {
    throw new Error("Could not initialize Firebase Admin Database");
  }

  try {
    // This function can now safely access collections like 'users' and 'properties'
    const usersSnapshot = await db.collection('users').get();
    const propertiesSnapshot = await db.collection('properties').get();
    
    return {
      success: true,
      stats: {
        userCount: usersSnapshot.size,
        propertyCount: propertiesSnapshot.size
      }
    };
  } catch (err: any) {
    console.error('Stats Refresh Error:', err.message);
    return { success: false, error: err.message };
  }
}
