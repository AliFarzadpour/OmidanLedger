
'use server';
/**
 * @fileOverview An AI agent that learns user-provided categorizations.
 *
 * - learnCategoryMapping - A function that handles learning the category mapping.
 * - LearnCategoryMappingInput - The input type for the learnCategoryMapping function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { initializeServerFirebase } from '@/ai/utils';
import { createHash } from 'crypto';


const LearnCategoryMappingInputSchema = z.object({
    transactionDescription: z
        .string()
        .describe('The original transaction description from which a rule will be created.'),
    primaryCategory: z.string().describe('The user-corrected primary category.'),
    secondaryCategory: z.string().describe('The user-corrected secondary category.'),
    subcategory: z.string().describe('The user-corrected subcategory.'),
    userId: z.string().describe('The Firebase UID of the user.'),
});

export type LearnCategoryMappingInput = z.infer<typeof LearnCategoryMappingInputSchema>;

export async function learnCategoryMapping(input: LearnCategoryMappingInput): Promise<void> {
  await learnCategoryMappingFlow(input);
}


const learnCategoryMappingFlow = ai.defineFlow(
  {
    name: 'learnCategoryMappingFlow',
    inputSchema: LearnCategoryMappingInputSchema,
    outputSchema: z.void(),
  },
  async (input) => {
    try {
      // 1. Initialize Server-Side Admin Firestore
      const { firestore } = initializeServerFirebase();
      const { transactionDescription, primaryCategory, secondaryCategory, subcategory, userId } = input;
      
      // FIX: Use the user-provided description directly, without generalization.
      const keywordForMatching = transactionDescription;

      // Create a consistent ID based on the *exact* keyword to prevent duplicates.
      const mappingId = createHash('md5').update(userId + keywordForMatching.toUpperCase()).digest('hex');

      // 2. USE ADMIN SDK SYNTAX
      await firestore
        .collection('users')
        .doc(userId)
        .collection('categoryMappings')
        .doc(mappingId)
        .set({
          userId,
          transactionDescription: keywordForMatching, // The keyword for matching
          primaryCategory,
          secondaryCategory,
          subcategory,
          source: 'User Manual',
          updatedAt: new Date(), 
      }, { merge: true });
    } catch (error: any) {
        console.error('Error in learnCategoryMappingFlow:', error);
        // Re-throw the error so the client that called the server action receives it.
        throw new Error(`Failed to learn category mapping: ${error.message}`);
    }
  }
);
