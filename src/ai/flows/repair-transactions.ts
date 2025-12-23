
'use server';
/**
 * @fileOverview A flow to repair and re-categorize existing transactions that are marked for review.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { db } from '@/lib/admin-db';
import { fetchUserContext, getCategoryFromDatabase, categorizeWithHeuristics } from '@/lib/plaid';

const RepairTransactionsInputSchema = z.object({
  userId: z.string(),
});

const RepairTransactionsOutputSchema = z.object({
  repairedCount: z.number(),
  scannedCount: z.number(),
});

export const repairUncategorizedTransactions = ai.defineFlow(
  {
    name: 'repairUncategorizedTransactions',
    inputSchema: RepairTransactionsInputSchema,
    outputSchema: RepairTransactionsOutputSchema,
  },
  async ({ userId }) => {
    const userContext = await fetchUserContext(db, userId);

    // 1. Find all "Broken" transactions (items needing review)
    const snapshot = await db
      .collectionGroup('transactions')
      .where('userId', '==', userId)
      .where('reviewStatus', '==', 'needs-review') // TARGET 'needs-review' status
      .get();

    console.log(`[Repair Flow] Found ${snapshot.size} items to repair...`);
    const batch = db.batch();
    let repairedCounter = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();

      // 2. Re-Run Rules Engine (Fast & Free)
      let ruleResult: any;

      // First, try the database (user & global rules)
      const dbResult = await getCategoryFromDatabase(data.description, userContext, db);
      
      if (dbResult) {
        ruleResult = {
          primary: dbResult.primaryCategory,
          secondary: dbResult.secondaryCategory,
          sub: dbResult.subcategory,
        };
      } else {
        // If DB fails, use the fallback heuristics
        ruleResult = await categorizeWithHeuristics(
          data.description,
          data.amount,
          null, // We don't have raw Plaid data here easily, that's fine
          userContext
        );
      }
      
      // 3. If the Rule found a better answer, update it
      if (ruleResult.sub !== 'General Expense' && ruleResult.secondary !== 'Uncategorized') {
        batch.update(doc.ref, {
          primaryCategory: ruleResult.primary,
          secondaryCategory: ruleResult.secondary,
          subcategory: ruleResult.sub,
          aiExplanation: 'Repaired via Rules Engine',
          reviewStatus: 'approved', // Mark as approved after repair
        });
        repairedCounter++;
      }
    }

    await batch.commit();
    
    return { repairedCount: repairedCounter, scannedCount: snapshot.size };
  }
);

// We need a server action to call this from the frontend
export async function repairTransactionsAction(userId: string) {
    if (!userId) {
        throw new Error("User ID is required.");
    }
    return await repairUncategorizedTransactions({ userId });
}
