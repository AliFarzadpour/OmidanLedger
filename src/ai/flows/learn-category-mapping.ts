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
import { generalizeTransactionDescription } from './generalize-transaction-description';


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
    // 1. Initialize Server-Side Admin Firestore
    const { firestore } = initializeServerFirebase();
    const { transactionDescription, primaryCategory, secondaryCategory, subcategory, userId } = input;
    
    // First, generalize the description to create a better rule.
    const { generalizedDescription } = await generalizeTransactionDescription({ transactionDescription });

    // Create a consistent ID based on the *generalized* description to prevent duplicates.
    const mappingId = createHash('md5').update(userId + generalizedDescription.toUpperCase()).digest('hex');

    // 2. USE ADMIN SDK SYNTAX
    await firestore
      .collection('users')
      .doc(userId)
      .collection('categoryMappings')
      .doc(mappingId)
      .set({
        userId,
        transactionDescription: generalizedDescription, // The generalized keyword for matching
        primaryCategory,
        secondaryCategory,
        subcategory,
        source: 'User Manual',
        updatedAt: new Date(), 
    }, { merge: true });
  }
);
