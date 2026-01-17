'use server';

import 'server-only';

import { answerHelpQuestion, indexMissingHelpEmbeddings } from '@/ai/help/rag';
import { isSuperAdmin } from '@/lib/auth-utils';

function isEnabled() {
  return process.env.ENABLE_HELP_RAG === 'true';
}

export async function askHelp(question: string) {
  if (!isEnabled()) {
    return {
      answer: 'Help Assistant is currently disabled.',
      sources: [],
    };
  }

  if (!question || question.trim().length < 3) {
    return { answer: 'Please enter a longer question.', sources: [] };
  }

  try {
    return await answerHelpQuestion(question.trim());
  } catch (err: any) {
    // Do not crash the page; return a friendly message
    return {
      answer:
        `Sorry — I couldn’t answer right now. ` +
        `If this persists, check server logs for GEMINI_API_KEY and embeddings config. ` +
        `(${err?.message || 'unknown error'})`,
      sources: [],
    };
  }
}

// Admin-only indexing; The calling page is responsible for an Admin check.
export async function indexHelpArticles() {
  if (!isEnabled()) return { updated: 0 };

  return await indexMissingHelpEmbeddings({ limit: 300 });
}
