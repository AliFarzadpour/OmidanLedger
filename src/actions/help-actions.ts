
'use server';

import 'server-only';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { isHelpEnabled } from '@/lib/help/help-config';
import { isSuperAdmin } from '@/lib/auth-utils';
import { retrieveTopK, type HelpArticle } from '@/lib/help/help-retrieval';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

// --- CONFIGURATION ---
const GENERATION_MODEL = 'gemini-2.5-flash';

// FIX: embedding-001 is shut down; use the stable Gemini embedding model
const EMBEDDING_MODEL = 'gemini-embedding-001';

// Split min lengths: questions can be short; articles should be longer
const MIN_QUERY_LENGTH = 4;
const MIN_DOC_LENGTH = 20;

const FRIENDLY_ERROR_MSG =
  'The Omidan Ledger Help Assistant is currently unavailable. Please try again later.';


// --- 1. Embedding Function ---
type EmbeddingResult =
  | { ok: true; embedding: number[] }
  | { ok: false; error: string };

async function embedText(
  text: string,
  mode: 'query' | 'document' = 'document'
): Promise<EmbeddingResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, error: 'Server configuration error: Missing API Key.' };

  const minLen = mode === 'query' ? MIN_QUERY_LENGTH : MIN_DOC_LENGTH;
  const cleaned = (text ?? '').trim();

  if (cleaned.length < minLen) {
    return { ok: false, error: `Text too short for ${mode} embedding (min ${minLen} chars).` };
  }

  try {
    // Use documented header auth instead of ?key=
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        model: `models/${EMBEDDING_MODEL}`,
        content: { parts: [{ text: cleaned }] },
        // Optional but helps retrieval quality for RAG (supported on newer models)
        taskType: mode === 'query' ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT',
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      return { ok: false, error: `Embedding API error: ${response.status} ${response.statusText} ${body}` };
    }

    const data = await response.json();
    const v = data?.embedding?.values;

    if (!Array.isArray(v) || v.length === 0) {
      return { ok: false, error: 'Invalid embedding response format (missing embedding.values).' };
    }

    return { ok: true, embedding: v };
  } catch (err: any) {
    return { ok: false, error: `Embedding failed: ${err?.message || String(err)}` };
  }
}

// --- 2. Generate ONE Specific Article (The "Surgical" Tool) ---
export async function generateSpecificArticle(userId: string, topic: string) {
  if (!(process.env.NEXT_PUBLIC_ENABLE_HELP_RAG === 'true')) throw new Error(FRIENDLY_ERROR_MSG);
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured.");
  if (!await isSuperAdmin(userId)) throw new Error("Permission denied.");
  if (!topic || topic.length < 5) throw new Error("Topic is too short.");

  const db = getAdminDb();

  const deepPrompt = `
    You are the Lead Technical Writer for 'Omidan Ledger'.
    YOUR TASK: Write ONE comprehensive help article about this specific topic: "${topic}".
    
    CRITICAL WRITING RULES:
    1. **TITLE**: Short and Concise (e.g., "How to Calculate DSCR").
    2. **BODY**: Detailed Step-by-Step instructions. Define terms if asked.
    3. **CATEGORY**: Choose the most relevant category (Real Estate, Accounting, or Admin).
    
    OUTPUT FORMAT (Strict JSON):
    { "articles": [ { "title": "...", "category": "...", "body": "...", "tags": [] } ] }
  `;

  const apiKey = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GENERATION_MODEL}:generateContent`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey!,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: deepPrompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    if (!response.ok) throw new Error(`AI Generation failed: ${response.status} ${await response.text()}`);

    const data = await response.json();
    const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!jsonText) throw new Error("Empty response from AI");
    
    const output = JSON.parse(jsonText);

    if (output.articles && output.articles.length > 0) {
      const article = output.articles[0];
      await db.collection('help_articles').add({
        ...article,
        updatedAt: new Date(),
        enabled: true,
        embedding: [] 
      });
      return { success: true, title: article.title };
    }
    
    throw new Error("No article generated.");

  } catch (error: any) {
    console.error("Generate Specific Error:", error);
    throw new Error(error.message || "Failed to generate content.");
  }
}

// --- 3. BULK Generator (Chunked) ---
export async function generateHelpArticlesFromCodebase(userId: string, targetCategory?: string) {
  if (!(process.env.NEXT_PUBLIC_ENABLE_HELP_RAG === 'true')) throw new Error(FRIENDLY_ERROR_MSG);
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured.");
  if (!await isSuperAdmin(userId)) throw new Error("Permission denied.");

  const db = getAdminDb();
  
  const categories = {
    'RealEstate_Setup': `Focus ONLY on Property Setup: Adding Properties, Debt Center (DSCR), Mortgages.`,
    'RealEstate_Ops': `Focus ONLY on Property Operations: Work Orders, Vendors, Rent Roll.`,
    'Accounting_Daily': `Focus ONLY on Daily Accounting: Transactions, Plaid Sync, Splitting, Smart Rules.`,
    'Accounting_Reports': `Focus ONLY on Financial Reporting: P&L, Balance Sheets, Invoices.`,
    'Admin': `Focus ONLY on Setup & Admin: Users, Opening Balances, Billing.`
  };

  const activeCategory = targetCategory && categories[targetCategory as keyof typeof categories] 
    ? targetCategory 
    : 'RealEstate_Setup';

  const categoryPrompt = categories[activeCategory as keyof typeof categories];

  const deepPrompt = `
    You are the Lead Technical Writer for 'Omidan Ledger'.
    YOUR TASK: Generate 10-15 comprehensive help articles covering ONLY: ${categoryPrompt}
    CRITICAL WRITING RULES: Title short, Body detailed step-by-step.
    OUTPUT FORMAT (Strict JSON): { "articles": [ { "title": "...", "category": "...", "body": "...", "tags": [] } ] }
  `;

  const apiKey = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GENERATION_MODEL}:generateContent`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey!,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: deepPrompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    if (!response.ok) throw new Error(`AI Generation failed: ${response.status} ${await response.text()}`);

    const data = await response.json();
    const output = JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
    const batch = db.batch();
    output.articles.forEach((article: any) => {
        const docRef = db.collection('help_articles').doc();
        batch.set(docRef, { ...article, updatedAt: new Date(), enabled: true, embedding: [] });
    });
    await batch.commit();
    return { created: output.articles.length, category: activeCategory };

  } catch (error: any) {
    throw new Error(error.message || "Bulk generation failed.");
  }
}

// --- 4. Index Help Articles ---
export async function indexHelpArticles(userId: string): Promise<{ ok: boolean; indexed: number; skipped: number; failed: number; errors: string[] }> {
  const result = { ok: true, indexed: 0, skipped: 0, failed: 0, errors: [] as string[] };

  try {
    if (!(process.env.NEXT_PUBLIC_ENABLE_HELP_RAG === 'true')) throw new Error("Help feature is not enabled.");
    if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured.");
    if (!await isSuperAdmin(userId)) throw new Error("Permission denied.");

    const db = getAdminDb();
    const batch = db.batch();
    const snapshot = await db.collection('help_articles').where('enabled', '==', true).get();

    if (snapshot.empty) { result.ok = false; return result; }

    for (const doc of snapshot.docs) {
      if (!doc.exists) continue;
      const article = doc.data();
      const updatedAt = article.updatedAt?.toDate() || new Date(0);
      const embeddingUpdatedAt = article.embeddingUpdatedAt?.toDate() || new Date(0);
      
      // If embedding is fresh, skip
      if (Array.isArray(article.embedding) && article.embedding.length > 0 && embeddingUpdatedAt >= updatedAt) {
        result.skipped++;
        continue;
      }

      const combinedText = [article.title, article.body].filter(Boolean).join('\n\n');
      const embeddingResult = await embedText(combinedText);
      if (embeddingResult.ok) {
        batch.update(doc.ref, { embedding: embeddingResult.embedding, embeddingUpdatedAt: new Date() });
        result.indexed++;
      } else {
        result.failed++;
        result.errors.push(`Doc "${article.title}": ${embeddingResult.error}`);
      }
    }
    if (result.indexed > 0) await batch.commit();
  } catch (err: any) {
    result.ok = false;
    result.errors.push(err.message || "Unknown error.");
  }
  return result;
}

// --- 5. Ask RAG ---
export async function askHelpRag(question: string) {
  if (!(process.env.NEXT_PUBLIC_ENABLE_HELP_RAG === 'true')) {
    return { answer: FRIENDLY_ERROR_MSG, sources: [] };
  }

  const q = (question ?? '').trim();
  if (!q) return { answer: "Please ask a question.", sources: [] };

  try {
    const db = getAdminDb();

    // IMPORTANT: use mode='query' so short questions don't get blocked
    const questionEmbeddingResult = await embedText(q, 'query');
    if (!questionEmbeddingResult.ok) {
      console.error('[HelpRAG] Query embedding failed:', questionEmbeddingResult.error);
      return { answer: "I'm having trouble analyzing your question.", sources: [] };
    }

    const snapshot = await db.collection('help_articles').where('enabled', '==', true).get();
    if (snapshot.empty) return { answer: "The knowledge base is empty.", sources: [] };

    const allArticles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as HelpArticle[];
    const sources = retrieveTopK(questionEmbeddingResult.embedding, allArticles, 5);

    if (sources.length === 0) {
      return { answer: "Sorry, I couldn't find any relevant help articles.", sources: [] };
    }

    const context = sources
      .map((s, i) => `Source ${i + 1}: ${s.title}\n${s.body}`)
      .join('\n\n---\n\n');

    const systemPrompt =
      `You are a helpful AI assistant for Omidan Ledger. ` +
      `Answer the user's question based ONLY on the provided sources below.`;

    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GENERATION_MODEL}:generateContent`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey!,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: `${systemPrompt}\n\nQuestion: ${q}\n\nSources:\n${context}` }],
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.error('[HelpRAG] Summary generation failed:', response.status, body);
      return { answer: "I found relevant articles (below), but couldn't summarize them.", sources };
    }

    const data = await response.json();
    const answer =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't generate a summary.";

    return { answer, sources: sources.map(s => ({ id: s.id, title: s.title, category: s.category })) };
  } catch (error: any) {
    console.error('[HelpRAG] System error:', error);
    return { answer: "A system error occurred while trying to answer your question.", sources: [] };
  }
}


// --- 6. Get All Articles (For KB Manager) ---
export async function getAllHelpArticles(userId: string) {
  if (!await isSuperAdmin(userId)) throw new Error("Permission denied.");
  const db = getAdminDb();
  const snapshot = await db.collection('help_articles').get();
  return snapshot.docs.map(doc => ({
    id: doc.id,
    title: doc.data().title || "Untitled",
    category: doc.data().category || "Uncategorized",
    snippet: (doc.data().body || "").substring(0, 100) + "..."
  }));
}

// --- 7. Delete Article ---
export async function deleteHelpArticle(userId: string, articleId: string) {
  if (!await isSuperAdmin(userId)) throw new Error("Permission denied.");
  const db = getAdminDb();
  await db.collection('help_articles').doc(articleId).delete();
  return { success: true };
}
