'use server';

import { db } from '@/lib/firebaseAdmin';

export async function isSuperAdmin(userId: string) {
  if (!userId) return false;
  
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) return false;
    
    const data = userDoc.data();
    return data?.role === 'admin';
  } catch (error) {
    console.error("isSuperAdmin check failed:", error);
    return false;
  }
}
