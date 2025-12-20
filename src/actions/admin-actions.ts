'use server';

import { db } from '@/lib/admin-db';
import { FieldValue } from 'firebase-admin/firestore';

export async function refreshGlobalSystemStats() {
  const db = getAdminDB();
  
  try {
    // 1. Get counts from main collections
    const landlordsSnap = await db.collection('users').where('role', '==', 'landlord').count().get();
    const propertiesSnap = await db.collection('properties').count().get();
    
    // 2. Sum up total transaction volume across the whole system
    // Note: In a massive system, you'd use a background worker for this.
    const monthlyStatsSnap = await db.collectionGroup('monthlyStats').get();
    let totalVolume = 0;
    
    monthlyStatsSnap.docs.forEach(doc => {
      const data = doc.data();
      // We sum absolute values of income + expenses to show "Activity Volume"
      totalVolume += (data.income || 0) + Math.abs(data.expenses || 0);
    });

    const stats = {
      totalLandlords: landlordsSnap.data().count,
      totalProperties: propertiesSnap.data().count,
      totalTransactionVolume: totalVolume,
      updatedAt: FieldValue.serverTimestamp(),
      systemStatus: 'Stable'
    };

    // 3. Save to the global system document
    await db.doc('system/global_stats').set(stats, { merge: true });

    return { success: true, stats };
  } catch (error: any) {
    console.error("Global Stats Error:", error);
    throw new Error(error.message);
  }
}
