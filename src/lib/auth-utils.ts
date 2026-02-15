'use server';

import { getAdminDb } from '@/lib/firebaseAdmin';

const SUPER_ADMIN_UID = 'ZzqaKaPSOGgg6eALbbs5NY9DRVZ2';

export async function isSuperAdmin(userId: string): Promise<boolean> {
  if (!userId) return false;

  // The primary, hardcoded user is always an admin.
  if (userId === SUPER_ADMIN_UID) {
    return true;
  }
  
  const db = getAdminDb();
  
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) return false;
    
    const data = userDoc.data();
    // Also allow for a 'role' field in Firestore for future flexibility.
    return data?.role === 'admin';
  } catch (error) {
    console.error("isSuperAdmin check failed:", error);
    return false;
  }
}
