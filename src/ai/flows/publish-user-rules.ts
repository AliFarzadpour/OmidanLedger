'use server';
/**
 * @fileOverview An admin-only flow to promote a user's personal categorization rules to the global ruleset.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getFirestore } from 'firebase-admin/firestore';
import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue } from 'firebase-admin/firestore';

// --- SECURITY: Replace with your actual Firebase User ID ---
const ADMIN_USER_ID = 'gHZ9n7s2b9X8fJ2kP3s5t8YxVOE2'; // 🚨 IMPORTANT!

// --- INITIALIZATION ---
function getAdminDB() {
  if (!getApps().length) {
    initializeApp();
  }
  return getFirestore();
}

const PublishRulesInputSchema = z.object({
  userId: z.string().describe('The ID of the user triggering the publish action.'),
});

const PublishRulesOutputSchema = z.object({
  success: z.boolean(),
  count: z.number(),
  message: z.string(),
});

export async function publishUserRulesToGlobal(input: z.infer<typeof PublishRulesInputSchema>): Promise<z.infer<typeof PublishRulesOutputSchema>> {
  return publishUserRulesToGlobalFlow(input);
}

const publishUserRulesToGlobalFlow = ai.defineFlow(
  {
    name: 'publishUserRulesToGlobalFlow',
    inputSchema: PublishRulesInputSchema,
    outputSchema: PublishRulesOutputSchema,
  },
  async ({ userId }) => {
    // --- Security Check ---
    if (userId !== ADMIN_USER_ID) {
      throw new Error('Permission Denied: This action is restricted to administrators.');
    }

    const db = getAdminDB();
    
    // 1. Get all rules the admin user has created
    // Note: The collection is named 'categoryMappings' based on the 'learn-category-mapping' flow.
    const userRulesSnap = await db.collection('users').doc(userId).collection('categoryMappings').get();
    
    if (userRulesSnap.empty) {
      return { success: true, count: 0, message: 'No custom rules found to publish.' };
    }

    const batch = db.batch();
    let count = 0;

    // 2. Copy them to the Global Master List
    userRulesSnap.docs.forEach(doc => {
        const ruleData = doc.data();
        // The document ID is the hashed, generalized description
        const globalRef = db.collection('globalVendorMap').doc(doc.id); 
        
        batch.set(globalRef, {
            originalKeyword: ruleData.transactionDescription, // The generalized description
            primary: ruleData.primaryCategory,
            secondary: ruleData.secondaryCategory,
            sub: ruleData.subcategory,
            source: 'Admin Published',
            updatedAt: FieldValue.serverTimestamp()
        }, { merge: true }); // Use merge to update existing global rules if necessary
        count++;
    });

    await batch.commit();
    
    return { 
        success: true, 
        count,
        message: `${count} rules have been successfully published to the global map.` 
    };
  }
);
