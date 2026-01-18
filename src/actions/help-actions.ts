
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
const GENERATION_MODEL = 'gemini-1.5-flash'; 
const EMBEDDING_MODEL = 'text-embedding-004'; 

const FRIENDLY_ERROR_MSG = 'The AI Help Assistant is currently unavailable. Please try again later.';
const MIN_CONTENT_LENGTH = 20;

// Helper: Recursively read all code files in a directory
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
  if (!apiKey) {
    console.error("[HELP][EMBED] Missing GEMINI_API_KEY in process.env");
    return { ok: false, error: 'Server configuration error: Missing API Key.' };
  }

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

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[HELP][EMBED] API Error ${response.status}:`, errorText);
      return { ok: false, error: `Google API Error: ${response.statusText}` };
    }

    const data = await response.json();
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

// --- 2. Generate Help Articles (Chunked by Category) ---
export async function generateHelpArticlesFromCodebase(userId: string, targetCategory?: string) {
  if (!(process.env.NEXT_PUBLIC_ENABLE_HELP_RAG === 'true')) throw new Error(FRIENDLY_ERROR_MSG);
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured.");
  if (!await isSuperAdmin(userId)) throw new Error("Permission denied.");

  const db = getAdminDb();

  const categories = {
    'RealEstate': `
      Focus ONLY on Real Estate Management:
      - Properties: Adding Single/Multi-family, editing settings, tax info.
      - Revenue Center: Rent Roll, Economic Occupancy, Collection Rate.
      - Debt Center: Mortgages, Loan Balance, Interest Paid, DSCR.
      - Operations: Work Orders, Vendors, Tenant Portals.
    `,
    'Accounting': `
      Focus ONLY on Accounting & Banking:
      - Dashboard: Net Income, Cash Flow, Expense Breakdown.
      - Transactions: Plaid Bank Sync, Splitting Transactions, Manual Adds.
      - Smart Rules: Auto-categorization, Schedule E mapping.
      - Invoices: Creating and sending tenant invoices.
      - Reports: P&L, Balance Sheet, Tax Packets.
    `,
    'Admin': `
      Focus ONLY on Setup & Admin:
      - Onboarding: Opening Balances (Assets/Liabilities).
      - Settings: User Roles & Permissions.
      - Billing: Managing the FiscalFlow subscription.
    `
  };

  const activeCategory = targetCategory && categories[targetCategory as keyof typeof categories] 
    ? targetCategory 
    : 'RealEstate';

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
    You are the Lead Technical Writer for 'FiscalFlow'.
    YOUR TASK: Generate 10-15 comprehensive help articles covering ONLY the following topic area:
    
    ${categoryPrompt}
    
    WRITING STYLE:
    - **Step-by-Step**: "1. Click X", "2. Select Y".
    - **Directional**: "Navigate to..."
    - **Specifics**: Use actual field names from the code context.
    
    ${promptSourceContext}
    
    OUTPUT FORMAT (JSON):
    Return a raw JSON object with an "articles" array.
  `;

  const apiKey = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GENERATION_MODEL}:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: deepPrompt }] }],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: {
                    articles: {
                        type: "ARRAY",
                        items: {
                            type: "OBJECT",
                            properties: {
                                title: { type: "STRING" },
                                category: { type: "STRING" },
                                body: { type: "STRING" },
                                tags: { type: "ARRAY", items: { type: "STRING" } }
                            }
                        }
                    }
                }
            }
        }
      })
    });

    if (!response.ok) throw new Error(`AI Generation failed: ${response.status} ${await response.text()}`);

    const data = await response.json();
    const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!jsonText) throw new Error("Empty response from AI");
    
    const output = JSON.parse(jsonText);

    const batch = db.batch();
    output.articles.forEach((article: any) => {
      const docRef = db.collection('help_articles').doc();
      batch.set(docRef, { ...article, updatedAt: new Date(), enabled: true, embedding: [] });
    });

    await batch.commit();
    return { created: output.articles.length, category: activeCategory };

  } catch (error: any) {
    console.error("Generate Error:", error);
    throw new Error(error.message || "Failed to generate content.");
  }
}

// --- 3. Generate ONE Specific Article (Incremental Add) ---
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
    You are the Lead Technical Writer for 'FiscalFlow'.
    YOUR TASK: Write ONE comprehensive help article about this specific topic: "${topic}".
    
    CRITICAL WRITING RULES:
    1. **TITLE**: Short and Concise (e.g., "How to Calculate DSCR").
    2. **BODY**: Detailed Step-by-Step instructions. Use numbered lists. Define terms if asked.
    3. **CATEGORY**: Choose the most relevant category (Real Estate, Accounting, or Admin).
    
    ${promptSourceContext}
    
    OUTPUT FORMAT (Strict JSON):
    { "articles": [ { "title": "...", "category": "...", "body": "...", "tags": [] } ] }
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

// --- 4. Index Help Articles ---
export async function indexHelpArticles(userId: string) {
    const result = { ok: true, indexed: 0, skipped: 0, failed: 0, errors: [] as string[] };
    try {
        if (!(process.env.NEXT_PUBLIC_ENABLE_HELP_RAG === 'true')) throw new Error("Help feature is not enabled.");
        if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured.");
        if (!await isSuperAdmin(userId)) throw new Error("Permission denied.");

        const db = getAdminDb();
        const snapshot = await db.collection('help_articles').where('enabled', '==', true).get();

        if (snapshot.empty) {
            result.ok = false;
            result.errors.push("No help articles found. Click Generate Help Content first.");
            return result;
        }

        const batch = db.batch();
        let operationsInBatch = 0;

        for (const doc of snapshot.docs) {
            const article = doc.data();
            
            if (Array.isArray(article.embedding) && article.embedding.length > 0) {
                 result.skipped++;
                 continue; 
            }
            
            const combinedText = [article.title, article.body].filter(Boolean).join('\n\n');
            if (combinedText.length < MIN_CONTENT_LENGTH) {
                console.warn(`[HELP][INDEX] Skipping short article ID: ${doc.id}`);
                result.skipped++;
                continue;
            }

            const embeddingResult = await embedText(combinedText);
            if (embeddingResult.ok) {
                batch.update(doc.ref, { embedding: embeddingResult.embedding, embeddingUpdatedAt: new Date() });
                result.indexed++;
                operationsInBatch++;
                
                if (operationsInBatch >= 450) {
                    await batch.commit();
                    operationsInBatch = 0;
                    console.log("[HELP][INDEX] Committed a batch of embeddings.");
                }

            } else {
                result.failed++;
                result.errors.push(`Failed to embed article ID ${doc.id}: ${embeddingResult.error}`);
            }
        }
        
        if (operationsInBatch > 0) {
            await batch.commit();
            console.log("[HELP][INDEX] Committed the final batch of embeddings.");
        }

    } catch (err: any) {
        console.error("[HELP][INDEX] Indexing failed:", err);
        result.ok = false;
        result.errors.push(err.message || 'An unknown error occurred during indexing.');
    }
    return result;
}

// --- 5. Ask RAG ---
export async function askHelpRag(question: string) {
  if (!(process.env.NEXT_PUBLIC_ENABLE_HELP_RAG === 'true')) {
    return { answer: FRIENDLY_ERROR_MSG, sources: [] };
  }
  if (!question.trim()) return { answer: "Please ask a question.", sources: [] };

  try {
    const db = getAdminDb();
    
    const questionEmbeddingResult = await embedText(question);
    
    if (!questionEmbeddingResult.ok) {
        console.error("Embedding failed during ASK:", questionEmbeddingResult.error);
        return { answer: "I'm having trouble analyzing your question. Please try again.", sources: [] };
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
    const systemPrompt = `You are a helpful AI assistant for FiscalFlow. Answer the user's question based ONLY on the provided sources below. If the answer isn't in the sources, say you don't know. Keep the answer concise and helpful.`;
    
    const apiKey = process.env.GEMINI_API_KEY;
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [{ text: `${systemPrompt}\n\nQuestion: ${question}\n\nSources:\n${context}` }]
        }]
      })
    });

    if (!response.ok) {
      console.error(`[HELP][ASK] Generation API Error ${response.status}:`, await response.text());
      return { 
        answer: "I found some relevant articles (listed below), but I couldn't summarize them right now.", 
        sources: sources.map(s => ({ id: s.id, title: s.title, category: s.category })) 
      };
    }

    const data = await response.json();
    const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't generate a summary.";

    return { 
      answer, 
      sources: sources.map(s => ({ id: s.id, title: s.title, category: s.category })) 
    };

  } catch (error: any) {
    console.error("[HELP][ASK] RAG pipeline failed:", error);
    return { answer: "There was a system error processing your request.", sources: [] };
  }
}

// --- 6. NEW: Get All Articles (For Management List) ---
export async function getAllHelpArticles(userId: string) {
  if (!await isSuperAdmin(userId)) throw new Error("Permission denied.");
  
  const db = getAdminDb();
  // Get all articles, but only fetch Title and Category to keep it fast
  const snapshot = await db.collection('help_articles').get();
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    title: doc.data().title || "Untitled",
    category: doc.data().category || "Uncategorized",
    snippet: (doc.data().body || "").substring(0, 100) + "..."
  }));
}

// --- 7. NEW: Delete Single Article ---
export async function deleteHelpArticle(userId: string, articleId: string) {
  if (!await isSuperAdmin(userId)) throw new Error("Permission denied.");
  
  const db = getAdminDb();
  await db.collection('help_articles').doc(articleId).delete();
  return { success: true };
}
