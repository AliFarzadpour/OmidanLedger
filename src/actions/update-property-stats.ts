'use server';

import { db as adminDb } from '@/lib/admin-db';
import { FieldValue } from 'firebase-admin/firestore';

// --- 1. THE "BIG BANG" RECALCULATOR ---
// Triggers manually to fix/update all stats from scratch
export async function recalculateAllStats(userId: string) {
  const db = adminDb;
  console.log(`Starting recalculation for user: ${userId}`);

  try {
    // A. Fetch ALL transactions for this user
    // We use a Collection Group query to find transactions across all bank accounts
    const snapshot = await db.collectionGroup('transactions')
      .where('userId', '==', userId)
      .get();

    if (snapshot.empty) {
        return { count: 0, message: "No transactions found." };
    }

    // B. Aggregate in Memory
    // Key format: "PROPERTY_ID::YYYY-MM" -> { income: 0, expenses: 0 }
    const updates: Record<string, { income: number, expenses: number, net: number }> = {};

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      
      // Skip if it's not assigned to a property or missing a date
      if (!data.propertyId || !data.date) return;

      const dateObj = new Date(data.date);
      // Format: "2025-12"
      const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
      const uniqueKey = `${data.propertyId}::${monthKey}`;

      // Initialize if missing
      if (!updates[uniqueKey]) {
          updates[uniqueKey] = { income: 0, expenses: 0, net: 0 };
      }

      const amt = data.amount || 0;
      
      // Logic: Positive = Income, Negative = Expense
      if (amt > 0) {
          updates[uniqueKey].income += amt;
      } else {
          updates[uniqueKey].expenses += amt;
      }
      updates[uniqueKey].net += amt;
    });

    // C. Write to Firestore (Batch)
    const batch = db.batch();
    const batchSize = 500; // Firestore limit
    let operationCount = 0;

    for (const [key, stats] of Object.entries(updates)) {
      const [propId, month] = key.split('::');
      const ref = db.doc(`properties/${propId}/monthlyStats/${month}`);
      
      batch.set(ref, {
        income: stats.income,
        expenses: stats.expenses, // Stored as negative number (e.g. -500)
        netIncome: stats.net,
        month: month,
        propertyId: propId,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });

      operationCount++;
      
      // Commit if batch gets too big (rare for personal apps, but good practice)
      if (operationCount >= batchSize) {
          await batch.commit();
          operationCount = 0; // Reset logic would go here for a new batch
      }
    }

    if (operationCount > 0) {
        await batch.commit();
    }

    return { count: Object.keys(updates).length, message: "Success" };

  } catch (error: any) {
      console.error("Recalculation Failed:", error);
      throw new Error(error.message);
  }
}

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
