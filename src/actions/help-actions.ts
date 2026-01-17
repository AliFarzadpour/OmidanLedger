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

async function embedText(text: string): Promise<number[] | null> {
  if (!process.env.GEMINI_API_KEY) return null;
  try {
    const res = await ai.embed({ model: GENKIT_EMBEDDING_MODEL, content: text });
    return res.embedding;
  } catch (err) {
    console.error("Embedding failed:", err);
    return null;
  }
}

/**
 * Admin-only action to generate help articles from the codebase.
 */
export async function generateHelpArticlesFromCodebase(userId: string) {
  if (!isHelpEnabled() || !process.env.GEMINI_API_KEY) throw new Error(FRIENDLY_ERROR_MSG);
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
 */
export async function indexHelpArticles(userId: string) {
  if (!isHelpEnabled() || !process.env.GEMINI_API_KEY) throw new Error(FRIENDLY_ERROR_MSG);
  if (!await isSuperAdmin(userId)) throw new Error("Permission denied.");

  const db = getAdminDb();
  const snapshot = await db.collection('help_articles').where('enabled', '==', true).get();
  
  let updatedCount = 0;
  const batch = db.batch();

  for (const doc of snapshot.docs) {
    const article = doc.data();
    if (article.embedding && article.embedding.length > 0) continue;

    const contentToEmbed = `${article.title}\n\n${article.body}`;
    const embedding = await embedText(contentToEmbed);

    if (embedding) {
      batch.update(doc.ref, { embedding, updatedAt: new Date() });
      updatedCount++;
    }
  }

  if (updatedCount > 0) await batch.commit();
  return { updated: updatedCount };
}

/**
 * Answers a user's question using the RAG pipeline.
 */
export async function askHelpRag(question: string) {
  if (!isHelpEnabled() || !process.env.GEMINI_API_KEY) {
    return { answer: FRIENDLY_ERROR_MSG, sources: [] };
  }
  if (!question.trim()) return { answer: "Please ask a question.", sources: [] };

  const db = getAdminDb();
  const questionEmbedding = await embedText(question);
  if (!questionEmbedding) throw new Error("Failed to embed question.");

  const snapshot = await db.collection('help_articles').where('enabled', '==', true).get();
  const allArticles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as HelpArticle[];

  const sources = retrieveTopK(questionEmbedding, allArticles, 5);

  const context = sources.map((s, i) => `Source ${i+1}: ${s.title}\n${s.body}`).join('\n\n---\n\n');
  const prompt = `You are a helpful AI assistant for the FiscalFlow app. Answer the user's question based ONLY on the provided sources.\n\nQuestion: ${question}\n\nSources:\n${context}`;

  const { output } = await ai.generate({ prompt, model: 'googleai/gemini-2.5-flash' });
  const answer = output?.text || "Sorry, I couldn't find an answer in the help articles.";
  
  return { answer, sources: sources.map(s => ({ id: s.id, title: s.title, category: s.category })) };
}
