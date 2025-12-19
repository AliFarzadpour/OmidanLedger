'use server';

import { db as adminDb } from '@/lib/admin-db';
import { FieldValue } from 'firebase-admin/firestore';

// --- 1. THE "BIG BANG" RECALCULATOR ---
// Triggers manually to fix/update all stats from scratch
export async function recalculateAllStats(userId: string) {
  const db = adminDb;
  console.log(`Starting smart recalculation for: ${userId}`);

  try {
    // 1. Load User's Smart Rules (to fix missing property IDs)
    const rulesSnap = await db.collection('users').doc(userId).collection('categoryMappings').get();
    const rules = rulesSnap.docs.map(doc => doc.data());

    // 2. Fetch ALL transactions
    const snapshot = await db.collectionGroup('transactions')
      .where('userId', '==', userId)
      .get();

    if (snapshot.empty) return { count: 0, message: "No transactions found." };

    const updates: Record<string, { income: number, expenses: number, net: number }> = {};
    const fixBatch = db.batch(); // Batch to fix the transactions themselves
    let fixCount = 0;

    // 3. Process Transactions
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      let propertyId = data.propertyId;

      // --- SELF-HEALING LOGIC ---
      // If propertyId is missing, try to find it using the Smart Rules
      if (!propertyId && data.description) {
        const desc = data.description.toUpperCase();
        // Find a rule that matches this description
        const matchingRule = rules.find(r => 
            desc.includes((r.originalKeyword || r.transactionDescription || '').toUpperCase())
        );

        if (matchingRule && matchingRule.propertyId) {
            propertyId = matchingRule.propertyId;
            // Queue an update to permanently fix this transaction in the DB
            fixBatch.update(doc.ref, { propertyId: propertyId });
            fixCount++;
        }
      }
      // ---------------------------

      // If we still don't have a propertyId, we can't chart it. Skip.
      if (!propertyId || !data.date) return;

      const dateObj = new Date(data.date);
      const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
      const uniqueKey = `${propertyId}::${monthKey}`;

      if (!updates[uniqueKey]) updates[uniqueKey] = { income: 0, expenses: 0, net: 0 };

      const amt = data.amount || 0;
      if (amt > 0) updates[uniqueKey].income += amt;
      else updates[uniqueKey].expenses += amt;
      updates[uniqueKey].net += amt;
    });

    // 4. Commit "Fixes" to Transactions (if any)
    if (fixCount > 0) {
        await fixBatch.commit();
        console.log(`Fixed property assignment for ${fixCount} transactions.`);
    }

    // 5. Write Stats to Firestore
    const statsBatch = db.batch();
    for (const [key, stats] of Object.entries(updates)) {
      const [propId, month] = key.split('::');
      const ref = db.doc(`properties/${propId}/monthlyStats/${month}`);
      
      statsBatch.set(ref, {
        income: stats.income,
        expenses: stats.expenses,
        netIncome: stats.net,
        month: month,
        propertyId: propId,
        userId: userId, // Ensure this is saved for security rules
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }

    await statsBatch.commit();

    return { count: Object.keys(updates).length, fixed: fixCount };

  } catch (error: any) {
      console.error("Recalculation Failed:", error);
      // NOTE: If you see "The query requires an index" in your console, 
      // you need to click the link provided in the error there.
      throw new Error(error.message);
  }
}
