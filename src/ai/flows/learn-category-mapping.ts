'use server';
/**
 * @fileOverview An AI agent that learns user-provided categorizations.
 *
 * - learnCategoryMapping - A function that handles learning the category mapping.
 * - LearnCategoryMappingInput - The input type for the learnCategoryMapping function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { initializeFirebase, setDocumentNonBlocking } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import { createHash } from 'crypto';


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
    
    // Create a consistent ID based on the content to prevent duplicates
    const mappingId = createHash('md5').update(userId + transactionDescription).digest('hex');

    const { firestore } = initializeFirebase();
    const mappingRef = doc(firestore, `users/${userId}/categoryMappings`, mappingId);

    // Use the non-blocking client-side function to set the document
    setDocumentNonBlocking(mappingRef, {
        userId,
        transactionDescription,
        primaryCategory,
        secondaryCategory,
        subcategory,
    }, { merge: true });
  }
);
