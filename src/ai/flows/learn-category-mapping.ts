'use server';
/**
 * @fileOverview An AI agent that learns user-provided categorizations.
 *
 * - learnCategoryMapping - A function that handles learning the category mapping.
 * - LearnCategoryMappingInput - The input type for the learnCategoryMapping function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { createHash } from 'crypto';

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();
const auth = getAuth();

const LearnCategoryMappingInputSchema = z.object({
    transactionDescription: z
        .string()
        .describe('The original transaction description.'),
    primaryCategory: z.string().describe('The user-corrected primary category.'),
    secondaryCategory: z.string().describe('The user-corrected secondary category.'),
    subcategory: z.string().describe('The user-corrected subcategory.'),
    idToken: z.string().describe('The Firebase ID token of the user.'),
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
    const { transactionDescription, primaryCategory, secondaryCategory, subcategory, idToken } = input;
    
    const decodedToken = await auth.verifyIdToken(idToken);
    const userId = decodedToken.uid;

    // Create a consistent ID based on the content to prevent duplicates
    const mappingId = createHash('md5').update(userId + transactionDescription).digest('hex');

    const mappingRef = db.collection(`users/${userId}/categoryMappings`).doc(mappingId);

    await mappingRef.set({
        userId,
        transactionDescription,
        primaryCategory,
        secondaryCategory,
        subcategory,
    }, { merge: true });
  }
);

    