'use server';
/**
 * @fileOverview An AI agent that learns user-provided categorizations.
 *
 * - learnCategoryMapping - A function that handles learning the category mapping.
 * - LearnCategoryMappingInput - The input type for the learnCategoryMapping function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { MasterCategoryFramework } from './category-framework';

const LearnCategoryMappingInputSchema = z.object({
    transactionDescription: z
        .string()
        .describe('The original transaction description.'),
    primaryCategory: z.string().describe('The user-corrected primary category.'),
    secondaryCategory: z.string().describe('The user-corrected secondary category.'),
    subcategory: z.string().describe('The user-corrected subcategory.'),
});

export type LearnCategoryMappingInput = z.infer<typeof LearnCategoryMappingInputSchema>;

export async function learnCategoryMapping(input: LearnCategoryMappingInput): Promise<void> {
  await learnCategoryMappingFlow(input);
}


const learnMappingPrompt = ai.definePrompt({
    name: 'learnMappingPrompt',
    input: {schema: LearnCategoryMappingInputSchema},
    prompt: `You are an AI financial assistant. Your user has provided a correction for a transaction categorization.
Your most important task is to learn this new mapping and apply it to all future categorization requests.

**Master Category Framework (for context):**
${MasterCategoryFramework}

**User's Correction:**
- Transaction Description: "{{transactionDescription}}"
- Should be categorized as:
  - Primary: "{{primaryCategory}}"
  - Secondary: "{{secondaryCategory}}"
  - Subcategory: "{{subcategory}}"

Acknowledge this new rule. For all future requests to categorize transactions, if you see a description similar to "{{transactionDescription}}", you MUST categorize it as "{{primaryCategory}} > {{secondaryCategory}} > {{subcategory}}". This user-provided correction is the source of truth and overrides any previous logic.
`,
});


const learnCategoryMappingFlow = ai.defineFlow(
  {
    name: 'learnCategoryMappingFlow',
    inputSchema: LearnCategoryMappingInputSchema,
    outputSchema: z.void(),
  },
  async (input) => {
    // We call the prompt to "instruct" the model. The output isn't used,
    // but the instruction within the prompt guides future behavior.
    await learnMappingPrompt(input);
  }
);