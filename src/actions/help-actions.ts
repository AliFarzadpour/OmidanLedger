
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

const EMBEDDING_MODEL = 'gemini-embedding-001';

// Split min lengths: questions can be short; articles should be longer
const MIN_QUERY_LENGTH = 4;
const MIN_DOC_LENGTH = 20;

const FRIENDLY_ERROR_MSG =
  'The Omidan Ledger Help Assistant is currently unavailable. Please try again later.';

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

    // Embed the user's question
    const questionEmbeddingResult = await embedText(q, 'query');
    if (!questionEmbeddingResult.ok) {
      console.error('[HelpRAG] Query embedding failed:', questionEmbeddingResult.error);
      return { answer: "I'm having trouble analyzing your question.", sources: [] };
    }

    // --- CONTEXT GATHERING ---
    // 1. Get source code context
    const srcDir = path.join(process.cwd(), 'src');
    let codebaseContext = "CONTEXT: No source code available.";
    if (fs.existsSync(srcDir)) {
      try {
        const files = readCodebase(srcDir);
        // Limit context size to be safe
        const allCode = files.join('\n').substring(0, 800000); 
        codebaseContext = `\n\n--- SOURCE CODE CONTEXT ---\n${allCode}`;
      } catch (err) { 
        console.error("Failed to read codebase for RAG:", err);
      }
    }

    // 2. Get Firestore article context
    const snapshot = await db.collection('help_articles').where('enabled', '==', true).get();
    let firestoreContext = "CONTEXT: No help articles found.";
    let sources: HelpArticle[] = [];
    
    if (!snapshot.empty) {
      const allArticles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as HelpArticle[];
      sources = retrieveTopK(questionEmbeddingResult.embedding, allArticles, 5);
      if (sources.length > 0) {
        firestoreContext = sources
          .map((s, i) => `Source ${i + 1}: ${s.title}\n${s.body}`)
          .join('\n\n---\n\n');
      }
    }

    // 3. Combine contexts
    const combinedContext = `
      --- HELP ARTICLES ---
      ${firestoreContext}
      
      ${codebaseContext}
    `;

    // 4. Generate Answer
    const systemPrompt =
      `You are a helpful AI assistant for Omidan Ledger. ` +
      `Answer the user's question based on the provided HELP ARTICLES and SOURCE CODE CONTEXT below. Prioritize the help articles if they are relevant.`;

    const finalPrompt = `${systemPrompt}\n\nQuestion: ${q}\n\nCONTEXT:\n${combinedContext}`;

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
            parts: [{ text: finalPrompt }],
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
