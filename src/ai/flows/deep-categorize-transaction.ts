
'use server';
/**
 * @fileOverview An AI agent that performs a deep analysis of a single transaction.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { DEEP_ANALYSIS_PROMPT, DeepCategorizationSchema } from '@/lib/prompts/deepAnalysis';

const DeepCategorizeInputSchema = z.object({
  description: z.string(),
  amount: z.number(),
  date: z.string(),
});

// The output from the AI will be just the 4-level hierarchy.
// We will return a more complete object from the flow.
const AICategoryOutputSchema = z.object({
    l0: z.string(),
    l1: z.string(),
    l2: z.string(),
    l3: z.string(),
});

export async function deepCategorizeTransaction(
  transaction: z.infer<typeof DeepCategorizeInputSchema>
): Promise<z.infer<typeof DeepCategorizationSchema> | null> {
  const deepAnalysisPrompt = ai.definePrompt(
    {
      name: 'deepCategorizationPrompt',
      input: { schema: DeepCategorizeInputSchema },
      output: { schema: AICategoryOutputSchema }, // Use the new 4-level output schema
      prompt: DEEP_ANALYSIS_PROMPT,
    },
  );

  try {
    const { output } = await deepAnalysisPrompt(transaction);
    
    if (!output) return null;

    // Construct the full object expected by the rest of the system
    return {
        merchantName: output.l3, // L3 is the cleaned merchant name
        categoryHierarchy: {
            l0: output.l0,
            l1: output.l1,
            l2: output.l2,
            l3: output.l3,
        },
        confidence: 0.9, // Assign a high confidence since this is our most advanced logic
        reasoning: "Categorized by deep analysis AI with strict taxonomy.",
        source: 'Deep AI Reasoning'
    };
  } catch (error) {
    console.error("Deep AI Failed:", error);
    return null; 
  }
}
