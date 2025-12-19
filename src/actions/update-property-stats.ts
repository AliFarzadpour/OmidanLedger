'use server';

import { db as adminDb } from '@/lib/admin-db';
import { FieldValue } from 'firebase-admin/firestore';

// ✅ THE BETTER "EASY" WAY: Incremental Updates
export async function incrementPropertyStats({
  propertyId,
  date,
  amount,
  multiplier = 1
}: {
  propertyId: string;
  date: string | Date; // Accept string or Date
  amount: number;
  multiplier?: 1 | -1; // To handle additions and subtractions
}) {
  if (!propertyId || !amount) return;

  const db = adminDb;
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
  
  const statsRef = db.doc(`properties/${propertyId}/monthlyStats/${monthKey}`);
  
  const finalAmount = amount * multiplier;

  // Determine buckets
  let incomeDelta = 0;
  let expenseDelta = 0;

  if (finalAmount > 0) {
    incomeDelta = finalAmount;
  } else {
    expenseDelta = finalAmount; // e.g. -50
  }

  try {
    await db.runTransaction(async (t) => {
        const doc = await t.get(statsRef);
        
        if (!doc.exists) {
          t.set(statsRef, {
            income: incomeDelta,
            expense: Math.abs(expenseDelta), // Store as positive number
            netIncome: finalAmount,
            month: monthKey,
            propertyId: propertyId,
            updatedAt: FieldValue.serverTimestamp()
          });
        } else {
          t.update(statsRef, {
            income: FieldValue.increment(incomeDelta),
            expense: FieldValue.increment(Math.abs(expenseDelta)),
            netIncome: FieldValue.increment(finalAmount),
            updatedAt: FieldValue.serverTimestamp()
          });
        }
      });
  } catch (error) {
      console.error("Error updating property stats:", error);
      // We don't re-throw here to prevent the client operation from failing
      // if the stats update has an issue. Logging is sufficient.
  }
}
