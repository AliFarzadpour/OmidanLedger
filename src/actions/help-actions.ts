'use server';

import 'server-only';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { isHelpEnabled } from '@/lib/help/help-config';
import { isSuperAdmin } from '@/lib/auth-utils';
import { ai } from '@/ai/genkit';
import { retrieveTopK, type HelpArticle } from '@/lib/help/help-retrieval';
import { z } from 'zod';

const FRIENDLY_ERROR_MSG = 'The AI Help Assistant is currently unavailable. Please try again later.';
const MIN_CONTENT_LENGTH = 20;

// --- REPLACED: Direct API Call Function ---
type EmbeddingResult =
  | { ok: true; embedding: number[] }
  | { ok: false; error: string };

async function embedText(text: string): Promise<EmbeddingResult> {
  // 1. Check for the Key
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[HELP][EMBED] Missing GEMINI_API_KEY in process.env");
    return { ok: false, error: 'Server configuration error: Missing API Key.' };
  }

  if (!text || text.trim().length < MIN_CONTENT_LENGTH) {
    return { ok: false, error: `Content too short (min ${MIN_CONTENT_LENGTH} chars).` };
  }

  try {
    // 2. Direct Call to Google Gemini API (Bypassing Genkit)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: "models/text-embedding-004",
        content: { parts: [{ text: text }] }
      })
    });

    // 3. Handle specific API errors nicely
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[HELP][EMBED] API Error ${response.status}:`, errorText);
      return { ok: false, error: `Google API Error: ${response.statusText}` };
    }

    const data = await response.json();

    // 4. Extract the vector safely
    const v = data?.embedding?.values;

    if (!Array.isArray(v)) {
       console.error('[HELP][EMBED] Unexpected response format:', JSON.stringify(data));
       return { ok: false, error: 'Invalid response format from Google API.' };
    }

    return { ok: true, embedding: v };

  } catch (err: any) {
    console.error('[HELP][EMBED] Network or parsing failed:', err);
    return { ok: false, error: `Embedding failed: ${err.message}` };
  }
}

// --- 2. Article Generation Action ---
export async function generateHelpArticlesFromCodebase(userId: string) {
  if (!isHelpEnabled()) throw new Error(FRIENDLY_ERROR_MSG);
  if (!await isSuperAdmin(userId)) throw new Error("Permission denied.");

  const db = getAdminDb();
  
  const fileContentPrompt = `
    Analyze the following key file paths and their descriptions from a Next.js/React application named 'FiscalFlow'.
    Based on this, generate 15-20 comprehensive help articles for end-users.

    - /dashboard/page.tsx: The main dashboard with KPI cards and charts.
    - /dashboard/transactions/page.tsx: The page for managing bank connections and viewing all transactions.
    - /dashboard/properties/page.tsx: The hub for adding and managing properties.
    - /dashboard/reports/page.tsx: The main reports hub.
    - /dashboard/reports/ai-report/page.tsx: The AI-powered financial report generator.
    - /dashboard/rules/page.tsx: The "Smart Rules" page for custom categorization.
    - /lib/plaid.ts & /firebase/errors.ts: Plaid connection logic and error handling.

    For each article, provide a 'title', 'category' (e.g., "Getting Started", "Banking", "Properties", "Reports", "Troubleshooting"), 'body' (in Markdown), and relevant 'tags' (lowercase array).
  `;

  const articleSchema = z.object({
    title: z.string(),
    category: z.string(),
    body: z.string(),
    tags: z.array(z.string()),
  });

  try {
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
  } catch (error: any) {
    console.error("Generate Error:", error);
    throw new Error(error.message || "Failed to generate content.");
  }
}

// --- 3. Indexing Action ---
export async function indexHelpArticles(userId: string): Promise<{
  ok: boolean;
  indexed: number;
  skipped: number;
  failed: number;
  errors: string[];
}> {
  const result = { ok: true, indexed: 0, skipped: 0, failed: 0, errors: [] as string[] };

  try {
    if (!isHelpEnabled()) throw new Error("Help feature is not enabled.");
    if (!await isSuperAdmin(userId)) throw new Error("Permission denied.");

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
      
      // Skip if embedding exists and is fresh
      const updatedAt = article.updatedAt?.toDate() || new Date(0);
      const embeddingUpdatedAt = article.embeddingUpdatedAt?.toDate() || new Date(0);
      
      if (Array.isArray(article.embedding) && article.embedding.length > 0 && embeddingUpdatedAt >= updatedAt) {
        result.skipped++;
        continue;
      }

      const title = article.title ?? '';
      const content = article.body ?? article.content ?? '';
      const combinedText = [title, content].filter(Boolean).join('\n\n');

      // Attempt to Embed
      const embeddingResult = await embedText(combinedText);

      if (embeddingResult.ok) {
        batch.update(doc.ref, { 
          embedding: embeddingResult.embedding, 
          embeddingUpdatedAt: new Date() 
        });
        result.indexed++;
      } else {
        console.error(`[HELP][INDEX] Failed to embed doc ${doc.id}: ${embeddingResult.error}`);
        result.failed++;
        result.errors.push(`Doc "${title}": ${embeddingResult.error}`);
      }
    }

    if (result.indexed > 0) {
      await batch.commit();
    }
  } catch (err: any) {
    console.error('[HELP][INDEX] Critical error:', err);
    result.ok = false;
    result.errors.push(err.message || "An unknown error occurred.");
  }

  if (result.failed > 0 && result.indexed === 0) {
     result.ok = false;
  }

  return result;
}

// --- 4. RAG / Q&A Action ---
export async function askHelpRag(question: string) {
  if (!isHelpEnabled()) return { answer: FRIENDLY_ERROR_MSG, sources: [] };
  if (!question.trim()) return { answer: "Please ask a question.", sources: [] };

  try {
    const db = getAdminDb();
    
    // Embed the User's Question
    const questionEmbeddingResult = await embedText(question);
    
    if (!questionEmbeddingResult.ok) {
        console.error("Embedding failed during ASK:", questionEmbeddingResult.error);
        return { answer: "I'm having trouble connecting to the AI service right now. Please try again.", sources: [] };
    }
    
    const questionEmbedding = questionEmbeddingResult.embedding;
    const snapshot = await db.collection('help_articles').where('enabled', '==', true).get();

    if (snapshot.empty) {
      return { answer: "The knowledge base is empty.", sources: [] };
    }

    const allArticles = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(doc => doc.title && doc.body) as HelpArticle[];

    const sources = retrieveTopK(questionEmbedding, allArticles, 5);

    if (sources.length === 0) {
      return { answer: "Sorry, I couldn't find any relevant help articles.", sources: [] };
    }

    const context = sources.map((s, i) => `Source ${i+1}: ${s.title}\n${s.body}`).join('\n\n---\n\n');
    const prompt = `You are a helpful AI assistant for the FiscalFlow app. Answer the user's question based ONLY on the provided sources.\n\nQuestion: ${question}\n\nSources:\n${context}`;

    const { output } = await ai.generate({ prompt, model: 'googleai/gemini-2.5-flash' });
    const answer = output?.text || "Sorry, I couldn't find an answer in the help articles.";

    return { answer, sources: sources.map(s => ({ id: s.id, title: s.title, category: s.category })) };

  } catch (error: any) {
    console.error("[HELP][ASK] RAG pipeline failed:", error);
    return { answer: "There was a system error processing your request.", sources: [] };
  }
}
