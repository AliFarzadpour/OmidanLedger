'use server';

import 'server-only';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { isHelpEnabled } from '@/lib/help/help-config';
import { isSuperAdmin } from '@/lib/auth-utils';
import { ai } from '@/ai/genkit';
import { retrieveTopK, type HelpArticle } from '@/lib/help/help-retrieval';
import { z } from 'zod';

const GENKIT_EMBEDDING_MODEL = 'googleai/text-embedding-004';
const FRIENDLY_ERROR_MSG = 'The AI Help Assistant is currently unavailable. Please try again later.';
const MIN_CONTENT_LENGTH = 20;

// Hardened embedText function
type EmbeddingResult = 
  | { ok: true; embedding: number[] }
  | { ok: false; error: string };

async function embedText(text: string): Promise<EmbeddingResult> {
  if (!process.env.GEMINI_API_KEY) {
    return { ok: false, error: "GEMINI_API_KEY is not set on the server." };
  }
  
  if (!text || text.trim().length < MIN_CONTENT_LENGTH) {
    return { ok: false, error: `Content is too short to embed (must be at least ${MIN_CONTENT_LENGTH} characters).` };
  }

  try {
    const res: any = await ai.embed({ model: GENKIT_EMBEDDING_MODEL, content: text });
    
    const v =
        res?.embedding?.values ??
        res?.embedding ??
        res?.[0]?.embedding?.values ??
        res?.[0]?.embedding ??
        null;
    
    if (!Array.isArray(v) || v.length < 5) { // Check for a reasonable vector length
      console.error('[HELP][EMBED] Invalid embedding response:', JSON.stringify(res));
      return { ok: false, error: 'Embedding model returned an invalid or empty vector.' };
    }
    
    return { ok: true, embedding: v };

  } catch (err: any) {
    console.error("[HELP][EMBED] Genkit embedding service failed:", err);
    return { ok: false, error: `Embedding service failed: ${err.message}` };
  }
}

/**
 * Admin-only action to generate help articles from the codebase.
 */
export async function generateHelpArticlesFromCodebase(userId: string) {
  if (!(process.env.NEXT_PUBLIC_ENABLE_HELP_RAG === 'true')) throw new Error(FRIENDLY_ERROR_MSG);
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured.");
  if (!await isSuperAdmin(userId)) throw new Error("Permission denied.");

  const db = getAdminDb();
  const fileContentPrompt = `
    Analyze the following key file paths and their descriptions from a Next.js/React application named 'FiscalFlow'.
    Based on this, generate 15-20 comprehensive help articles for end-users.

    - /dashboard/page.tsx: The main dashboard with KPI cards and charts.
    - /dashboard/transactions/page.tsx: The page for managing bank connections and viewing all transactions.
    - /dashboard/properties/page.tsx: The hub for adding and managing properties (both single-family and multi-family).
    - /dashboard/reports/page.tsx: The main reports hub.
    - /dashboard/reports/ai-report/page.tsx: The AI-powered financial report generator.
    - /dashboard/rules/page.tsx: The "Smart Rules" page for custom categorization.
    - /lib/plaid.ts & /firebase/errors.ts: Files containing Plaid connection logic and permission error handling.

    For each article, provide a 'title', 'category' (e.g., "Getting Started", "Banking", "Properties", "Reports", "Troubleshooting"), 'body' (in Markdown), and relevant 'tags' (lowercase array).
  `;
  
  const articleSchema = z.object({
    title: z.string(),
    category: z.string(),
    body: z.string(),
    tags: z.array(z.string()),
  });

  const { output } = await ai.generate({
    prompt: fileContentPrompt,
    model: 'googleai/gemini-2.5-flash',
    output: { schema: z.object({ articles: z.array(articleSchema) }) },
  });

  if (!output || !output.articles) throw new Error("Failed to generate articles from AI.");

  const batch = db.batch();
  output.articles.forEach(article => {
    const docRef = db.collection('help_articles').doc();
    batch.set(docRef, { ...article, updatedAt: new Date(), enabled: true, embedding: [] });
  });

  await batch.commit();
  return { created: output.articles.length };
}

/**
 * Admin-only action to create and store embeddings for help articles.
 * Returns a detailed status object.
 */
export async function indexHelpArticles(userId: string): Promise<{
    ok: boolean;
    indexed: number;
    skipped: number;
    failed: number;
    errors: string[];
}> {
  const result = { ok: true, indexed: 0, skipped: 0, failed: 0, errors: [] as string[] };

  try {
    if (!(process.env.NEXT_PUBLIC_ENABLE_HELP_RAG === 'true')) {
      throw new Error("Help feature is not enabled.");
    }
    if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not configured on the server.");
    }
    if (!await isSuperAdmin(userId)) {
        throw new Error("Permission denied.");
    }

    const db = getAdminDb();
    const batch = db.batch();
    const snapshot = await db.collection('help_articles').where('enabled', '==', true).get();

    if (snapshot.empty) {
        result.ok = false;
        result.errors.push("No help articles found. Click 'Generate Help Content' first.");
        return result;
    }

    for (const doc of snapshot.docs) {
      if (!doc.exists) {
        result.skipped++;
        continue;
      }
      
      const article = doc.data();
      if (!article) {
        console.error(`[HELP][INDEX] Document ${doc.id} has no data.`);
        result.skipped++;
        continue;
      }

      // Skip if embedding exists and is not older than content
      const updatedAt = article.updatedAt?.toDate() || new Date(0);
      const embeddingUpdatedAt = article.embeddingUpdatedAt?.toDate() || new Date(0);
      if (Array.isArray(article.embedding) && article.embedding.length > 0 && embeddingUpdatedAt >= updatedAt) {
          result.skipped++;
          continue;
      }

      const title = article.title ?? '';
      const content = article.body ?? article.content ?? '';
      const combinedText = [title, content].filter(Boolean).join('\n\n');

      if (combinedText.trim().length < MIN_CONTENT_LENGTH) {
        console.error(`[HELP][INDEX] Document ${doc.id} has insufficient content to embed.`);
        result.skipped++;
        continue;
      }

      const embeddingResult = await embedText(combinedText);
      if (embeddingResult.ok) {
        batch.update(doc.ref, { embedding: embeddingResult.embedding, embeddingUpdatedAt: new Date() });
        result.indexed++;
      } else {
        console.error(`[HELP][INDEX] Failed to embed doc ${doc.id}: ${embeddingResult.error}`);
        result.failed++;
        result.errors.push(`Doc ID ${doc.id}: ${embeddingResult.error}`);
      }
    }

    if (result.indexed > 0) {
      await batch.commit();
    }
  } catch (err: any) {
    console.error('[HELP][INDEX] A critical error occurred during indexing:', err);
    result.ok = false;
    result.errors.push(err.message || "An unknown error occurred while fetching articles.");
  }
  
  if (result.failed > 0) {
      result.ok = false;
  }

  return result;
}


/**
 * Answers a user's question using the RAG pipeline.
 */
export async function askHelpRag(question: string) {
    if (!(process.env.NEXT_PUBLIC_ENABLE_HELP_RAG === 'true')) {
        return { answer: FRIENDLY_ERROR_MSG, sources: [] };
    }
    if (!question.trim()) return { answer: "Please ask a question.", sources: [] };

    try {
        const db = getAdminDb();
        const questionEmbeddingResult = await embedText(question);
        if (!questionEmbeddingResult.ok) {
            throw new Error(questionEmbeddingResult.error);
        }
        const questionEmbedding = questionEmbeddingResult.embedding;
        
        const snapshot = await db.collection('help_articles').where('enabled', '==', true).get();

        if (snapshot.empty) {
            return { answer: "The knowledge base is empty. Please ask an admin to generate content.", sources: [] };
        }

        const allArticles = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(doc => doc.title && doc.body) as HelpArticle[];

        const sources = retrieveTopK(questionEmbedding, allArticles, 5);

        if (sources.length === 0) {
            return { answer: "Sorry, I couldn't find any relevant help articles for your question.", sources: [] };
        }

        const context = sources.map((s, i) => `Source ${i+1}: ${s.title}\n${s.body}`).join('\n\n---\n\n');
        const prompt = `You are a helpful AI assistant for the FiscalFlow app. Answer the user's question based ONLY on the provided sources.\n\nQuestion: ${question}\n\nSources:\n${context}`;

        const { output } = await ai.generate({ prompt, model: 'googleai/gemini-2.5-flash' });
        const answer = output?.text || "Sorry, I couldn't find an answer in the help articles.";
        
        return { answer, sources: sources.map(s => ({ id: s.id, title: s.title, category: s.category })) };

    } catch (error: any) {
        console.error("[HELP][ASK] RAG pipeline failed:", error);
        throw new Error(error.message || 'There was a problem answering your question.');
    }
}
