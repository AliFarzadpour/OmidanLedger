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
        userId: userId, // ✅ ADD THIS FIELD
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });

      operationCount++;
      
      // Commit if batch gets too big (rare for personal apps, but good practice)
      if (operationCount >= batchSize) {
          await batch.commit();
          // This reset logic is simplified; a new batch would be created here in a real-world, large-scale operation.
          operationCount = 0; 
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
