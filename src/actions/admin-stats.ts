'use server';

import { db } from '@/lib/admin-db';
import { FieldValue } from 'firebase-admin/firestore';

export async function updateGlobalStats() {
  const landlordsSnap = await db.collection('users').where('role', '==', 'landlord').count().get();
  const propertiesSnap = await db.collection('properties').count().get();
  
  await db.doc('system/global_stats').set({
    totalLandlords: landlordsSnap.data().count,
    totalProperties: propertiesSnap.data().count,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return { success: true };
}
