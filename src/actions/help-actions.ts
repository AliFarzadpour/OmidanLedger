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
// CRITICAL FIX: Always use 2.5-flash (1.5 is retired/404)
const GENERATION_MODEL = 'gemini-2.5-flash'; 
// CRITICAL FIX: Use text-embedding-004 for stable indexing
const EMBEDDING_MODEL = 'text-embedding-004'; 

const FRIENDLY_ERROR_MSG = 'The Omidan Ledger Help Assistant is currently unavailable. Please try again later.';
const MIN_CONTENT_LENGTH = 20;

// --- HELPER: Hybrid File Reader ---
function readCodebase(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const filePath = path.join(dir, file);
    try {
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        if (file !== 'node_modules' && file !== '.next' && file !== '.git' && file !== 'fonts') {
          readCodebase(filePath, fileList);
        }
      } else {
        if (/\.(tsx|ts|js|jsx)$/.test(file)) {
          const content = fs.readFileSync(filePath, 'utf8');
          fileList.push(`\n--- FILE: ${filePath} ---\n${content}`);
        }
      }
    } catch (err) { }
  });
  return fileList;
}

// --- 1. Embedding Function ---
type EmbeddingResult = | { ok: true; embedding: number[] } | { ok: false; error: string };

async function embedText(text: string): Promise<EmbeddingResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, error: 'Server configuration error: Missing API Key.' };

  if (!text || text.trim().length < MIN_CONTENT_LENGTH) {
    return { ok: false, error: `Content too short (min ${MIN_CONTENT_LENGTH} chars).` };
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: `models/${EMBEDDING_MODEL}`,
        content: { parts: [{ text: text }] }
      })
    });

    if (!response.ok) return { ok: false, error: `Google API Error: ${response.statusText}` };

    const data = await response.json();
    const v = data?.embedding?.values;
    if (!Array.isArray(v)) return { ok: false, error: 'Invalid response format.' };
    return { ok: true, embedding: v };
  } catch (err: any) {
    return { ok: false, error: `Embedding failed: ${err.message}` };
  }
}

// --- 2. Generate ONE Specific Article (The "Surgical" Tool) ---
export async function generateSpecificArticle(userId: string, topic: string) {
  if (!(process.env.NEXT_PUBLIC_ENABLE_HELP_RAG === 'true')) throw new Error(FRIENDLY_ERROR_MSG);
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured.");
  if (!await isSuperAdmin(userId)) throw new Error("Permission denied.");
  if (!topic || topic.length < 5) throw new Error("Topic is too short.");

  const db = getAdminDb();

  const srcDir = path.join(process.cwd(), 'src');
  let promptSourceContext = "CONTEXT: Production Mode.";
  if (fs.existsSync(srcDir)) {
    try {
      const files = readCodebase(srcDir);
      const allCode = files.join('\n').substring(0, 1500000); 
      promptSourceContext = `SOURCE CODE CONTEXT:\n${allCode}`;
    } catch (err) { }
  }

  const deepPrompt = `
    You are the Lead Technical Writer for 'Omidan Ledger'.
    YOUR TASK: Write ONE comprehensive help article about this specific topic: "${topic}".
    
    CRITICAL WRITING RULES:
    1. **TITLE**: Short and Concise (e.g., "How to Calculate DSCR").
    2. **BODY**: Detailed Step-by-Step instructions. Define terms if asked.
    3. **CATEGORY**: Choose the most relevant category (Real Estate, Accounting, or Admin).
    
    ${promptSourceContext}
    
    OUTPUT FORMAT (Strict JSON):
    { "articles": [ { "title": "...", "category": "...", "body": "...", "tags": [] } ] }
  `;

  // USING GENERATION_MODEL CONSTANT (gemini-2.5-flash)
  const apiKey = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GENERATION_MODEL}:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

  const srcDir = path.join(process.cwd(), 'src');
  let promptSourceContext = "CONTEXT: Production Mode.";
  if (fs.existsSync(srcDir)) {
    try {
      const files = readCodebase(srcDir);
      const allCode = files.join('\n').substring(0, 1500000); 
      promptSourceContext = `SOURCE CODE CONTEXT:\n${allCode}`;
    } catch (err) { }
  }

  const deepPrompt = `
    You are the Lead Technical Writer for 'Omidan Ledger'.
    YOUR TASK: Generate 10-15 comprehensive help articles covering ONLY: ${categoryPrompt}
    CRITICAL WRITING RULES: Title short, Body detailed step-by-step.
    ${promptSourceContext}
    OUTPUT FORMAT (Strict JSON): { "articles": [ { "title": "...", "category": "...", "body": "...", "tags": [] } ] }
  `;

  const apiKey = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GENERATION_MODEL}:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
  if (!(process.env.NEXT_PUBLIC_ENABLE_HELP_RAG === 'true')) return { answer: FRIENDLY_ERROR_MSG, sources: [] };
  if (!question.trim()) return { answer: "Please ask a question.", sources: [] };

  try {
    const db = getAdminDb();
    const questionEmbeddingResult = await embedText(question);
    if (!questionEmbeddingResult.ok) return { answer: "I'm having trouble analyzing your question.", sources: [] };
    
    const snapshot = await db.collection('help_articles').where('enabled', '==', true).get();
    if (snapshot.empty) return { answer: "The knowledge base is empty.", sources: [] };

    const allArticles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as HelpArticle[];
    const sources = retrieveTopK(questionEmbeddingResult.embedding, allArticles, 5);

    if (sources.length === 0) return { answer: "Sorry, I couldn't find any relevant help articles.", sources: [] };

    const context = sources.map((s, i) => `Source ${i+1}: ${s.title}\n${s.body}`).join('\n\n---\n\n');
    const systemPrompt = `You are a helpful AI assistant for Omidan Ledger. Answer the user's question based ONLY on the provided sources below.`;
    
    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GENERATION_MODEL}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\nQuestion: ${question}\n\nSources:\n${context}` }] }]
      })
    });

    if (!response.ok) return { answer: "I found relevant articles (below), but couldn't summarize them.", sources: sources };

    const data = await response.json();
    const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't generate a summary.";

    return { answer, sources: sources.map(s => ({ id: s.id, title: s.title, category: s.category })) };
  } catch (error: any) {
    return { answer: "System error.", sources: [] };
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