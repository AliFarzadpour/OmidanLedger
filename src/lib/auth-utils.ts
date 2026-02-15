
'use server';

import { getAdminDb } from '@/lib/firebaseAdmin';

export async function isSuperAdmin(userId: string): Promise<boolean> {
  if (!userId) return false;
  
  const db = getAdminDb();
  
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) return false;
    
    const data = userDoc.data();
    // A user is an admin if their 'role' field in Firestore is explicitly set to 'admin'.
    return data?.role === 'admin';
  } catch (error) {
    console.error("isSuperAdmin check failed:", error);
    return false;
  }
}
