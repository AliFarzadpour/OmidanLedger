'use server';
/**
 * @fileOverview An AI agent that learns user-provided categorizations.
 *
 * - learnCategoryMapping - A function that handles learning the category mapping.
 * - LearnCategoryMappingInput - The input type for the learnCategoryMapping function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { setDocumentNonBlocking } from '@/firebase';
import { initializeServerFirebase } from '@/ai/utils';
import { doc } from 'firebase/firestore';
import { createHash } from 'crypto';
import { generalizeTransactionDescription } from './generalize-transaction-description';


const LearnCategoryMappingInputSchema = z.object({
    transactionDescription: z
        .string()
        .describe('The original transaction description.'),
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
    const { transactionDescription, primaryCategory, secondaryCategory, subcategory, userId } = input;
    
    // First, generalize the description to create a better rule.
    const { generalizedDescription } = await generalizeTransactionDescription({ transactionDescription });

    // Create a consistent ID based on the *generalized* description to prevent duplicates.
    const mappingId = createHash('md5').update(userId + generalizedDescription).digest('hex');

    const { firestore } = initializeServerFirebase();
    const mappingRef = doc(firestore, `users/${userId}/categoryMappings`, mappingId);

    // Save the generalized description as the key for the rule.
    await setDoc(mappingRef, {
        userId,
        transactionDescription: generalizedDescription,
        primaryCategory,
        secondaryCategory,
        subcategory,
    }, { merge: true });
  }
);
