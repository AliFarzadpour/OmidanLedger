'use server';

import { db } from '@/lib/admin-db';

export async function isSuperAdmin(userId: string) {
  const userDoc = await db.collection('users').doc(userId).get();
  
  if (!userDoc.exists) return false;
  
  const userData = userDoc.data();
  return userData?.role === 'admin';
}
