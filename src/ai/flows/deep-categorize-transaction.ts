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

export async function deepCategorizeTransaction(
  transaction: z.infer<typeof DeepCategorizeInputSchema>
): Promise<z.infer<typeof DeepCategorizationSchema> | null> {
  const deepAnalysisPrompt = ai.definePrompt(
    {
      name: 'deepCategorizationPrompt',
      input: { schema: DeepCategorizeInputSchema },
      output: { schema: DeepCategorizationSchema },
      prompt: DEEP_ANALYSIS_PROMPT,
    },
  );

  try {
    const { output } = await deepAnalysisPrompt(transaction);
    
    if (!output) return null;

    return {
        ...output,
        source: 'Deep AI Reasoning'
    } as any;
  } catch (error) {
    console.error("Deep AI Failed:", error);
    return null; 
  }
}
