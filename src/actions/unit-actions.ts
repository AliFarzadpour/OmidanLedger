'use server';

import { getAdminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

const db = getAdminDb();

export async function updateUnitsInBulk(
  propertyId: string,
  unitIds: string[],
  updates: { [key: string]: any }
) {
  if (!propertyId || !unitIds || unitIds.length === 0 || Object.keys(updates).length === 0) {
    throw new Error('Invalid arguments for bulk unit update.');
  }

  const batch = db.batch();

  unitIds.forEach(unitId => {
    const unitRef = db.collection('properties').doc(propertyId).collection('units').doc(unitId);
    batch.update(unitRef, {
        ...updates,
        updatedAt: FieldValue.serverTimestamp()
    });
  });

  try {
    await batch.commit();
    return { success: true, count: unitIds.length };
  } catch (error: any) {
    console.error("Bulk unit update failed:", error);
    throw new Error(error.message);
  }
}
