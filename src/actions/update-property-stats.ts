'use server';

import { db as adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Updates financial stats for a specific property.
 * Called automatically during Plaid sync.
 */
export async function incrementPropertyStats({
  propertyId,
  date,
  amount,
  userId
}: {
  propertyId: string;
  date: string | Date;
  amount: number;
  userId: string;
}) {
  if (!propertyId || !userId) return; // Silent exit for unassigned data

  const db = adminDb;
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
  
  const statsRef = db.doc(`properties/${propertyId}/monthlyStats/${monthKey}`);
  
  const incomeDelta = amount > 0 ? amount : 0;
  const expenseDelta = amount < 0 ? amount : 0;

  try {
    await db.runTransaction(async (t) => {
      const doc = await t.get(statsRef);
      if (!doc.exists) {
        t.set(statsRef, {
          income: incomeDelta,
          expenses: expenseDelta,
          netIncome: amount,
          month: monthKey,
          propertyId: propertyId,
          userId: userId,
          updatedAt: FieldValue.serverTimestamp()
        });
      } else {
        t.update(statsRef, {
          income: FieldValue.increment(incomeDelta),
          expenses: FieldValue.increment(expenseDelta),
          netIncome: FieldValue.increment(amount),
          updatedAt: FieldValue.serverTimestamp()
        });
      }
    });
  } catch (error) {
    console.error(`Admin Error: Failed to increment stats:`, error);
  }
}


/**
 * Scans all historical transactions for a user.
 */
export async function recalculateAllStats(userId: string) {
  if (!userId) return { count: 0, message: "No user ID provided" };

  const db = adminDb;
  const allTransactionsSnap = await db.collectionGroup('transactions').where('userId', '==', userId).get();

  if (allTransactionsSnap.empty) {
      return { count: 0, message: "Fresh user, no records to update." };
  }

  const monthlyAggregates: { [key: string]: { income: number; expenses: number; propertyId: string; userId: string; month: string } } = {};

  allTransactionsSnap.docs.forEach(doc => {
      const tx = doc.data();
      if (!tx.propertyId || !tx.date) return;

      const date = new Date(tx.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const statKey = `${tx.propertyId}_${monthKey}`;

      if (!monthlyAggregates[statKey]) {
          monthlyAggregates[statKey] = {
              income: 0,
              expenses: 0,
              propertyId: tx.propertyId,
              userId: tx.userId,
              month: monthKey
          };
      }

      if (tx.amount > 0) {
          monthlyAggregates[statKey].income += tx.amount;
      } else {
          monthlyAggregates[statKey].expenses += tx.amount;
      }
  });

  const batch = db.batch();
  Object.values(monthlyAggregates).forEach(agg => {
      const statRef = db.doc(`properties/${agg.propertyId}/monthlyStats/${agg.month}`);
      batch.set(statRef, {
          ...agg,
          netIncome: agg.income + agg.expenses,
          updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
  });

  await batch.commit();

  return { count: Object.keys(monthlyAggregates).length, message: "Successfully recalculated all stats." };
}
