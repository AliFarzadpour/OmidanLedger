'use server';

import 'server-only';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { isSuperAdmin } from '@/lib/auth-utils';
import { retrieveTopK, type HelpArticle } from '@/lib/help/help-retrieval';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

// --- CONFIGURATION ---
const GENERATION_MODEL = 'gemini-2.5-flash';
const EMBEDDING_MODEL = 'text-embedding-004'; 
const FRIENDLY_ERROR_MSG = 'The AI Help Assistant is currently unavailable. Please try again later.';
const MIN_CONTENT_LENGTH = 20;

// Helper: Recursively read all code files in a directory
function readCodebase(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next' && file !== '.git' && file !== 'fonts') {
        readCodebase(filePath, fileList);
      }
    } else {
      // Only read relevant code files
      if (/\.(tsx|ts|js|jsx)$/.test(file)) {
        // Read the file content
        const content = fs.readFileSync(filePath, 'utf8');
        // Add a header so the AI knows which file this is
        fileList.push(`\n--- FILE: ${filePath} ---\n${content}`);
      }
    }
  });
  return fileList;
}

// --- 1. Hardened Embedding Function ---
type EmbeddingResult =
  | { ok: true; embedding: number[] }
  | { ok: false; error: string };

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

  // 1. DEFINE CATEGORIES
  // If no category is passed, default to the first one (or handle UI logic to loop)
  // We will run this function multiple times, once for each block.
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

  // Select the specific prompt part based on input, or default to RealEstate for a test run
  const activeCategory = targetCategory && categories[targetCategory as keyof typeof categories] 
    ? targetCategory 
    : 'RealEstate';

  const categoryPrompt = categories[activeCategory as keyof typeof categories];

  // 2. READ CODE (Standard Hybrid Read)
  const srcDir = path.join(process.cwd(), 'src');
  let promptSourceContext = "CONTEXT: Production Mode.";
  if (fs.existsSync(srcDir)) {
    try {
      const files = readCodebase(srcDir);
      const allCode = files.join('\n').substring(0, 1500000); // 1.5MB limit
      promptSourceContext = `SOURCE CODE CONTEXT:\n${allCode}`;
    } catch (err) { }
  }

  // 3. THE PROMPT (Scoped to 10-15 articles)
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

// --- 3. Index Help Articles ---
export async function indexHelpArticles(userId: string): Promise<{
  ok: boolean;
  indexed: number;
  skipped: number;
  failed: number;
  errors: string[];
}> {
  const result = { ok: true, indexed: 0, skipped: 0, failed: 0, errors: [] as string[] };

  try {
    if (!(process.env.NEXT_PUBLIC_ENABLE_HELP_RAG === 'true')) throw new Error("Help feature is not enabled.");
    if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured.");
    if (!await isSuperAdmin(userId)) throw new Error("Permission denied.");

    const db = getAdminDb();
    const batch = db.batch();
    const snapshot = await db.collection('help_articles').where('enabled', '==', true).get();

    if (snapshot.empty) {
      result.ok = false;
      result.errors.push("No help articles found.");
      return result;
    }

    for (const doc of snapshot.docs) {
      if (!doc.exists) continue;
      const article = doc.data();
      
      if (!article) continue;

      const updatedAt = article.updatedAt?.toDate() || new Date(0);
      const embeddingUpdatedAt = article.embeddingUpdatedAt?.toDate() || new Date(0);
      if (Array.isArray(article.embedding) && article.embedding.length > 0 && embeddingUpdatedAt >= updatedAt) {
        result.skipped++;
        continue;
      }

      const title = article.title ?? '';
      const content = article.body ?? article.content ?? '';
      const combinedText = [title, content].filter(Boolean).join('\n\n');
      
      if(combinedText.trim().length < MIN_CONTENT_LENGTH) {
          result.skipped++;
          continue;
      }

      const embeddingResult = await embedText(combinedText);
      if (embeddingResult.ok) {
        batch.update(doc.ref, { embedding: embeddingResult.embedding, embeddingUpdatedAt: new Date() });
        result.indexed++;
      } else {
        result.failed++;
        result.errors.push(`Doc "${title}": ${embeddingResult.error}`);
      }
    }

    if (result.indexed > 0) await batch.commit();
  } catch (err: any) {
    console.error('[HELP][INDEX] Critical error:', err);
    result.ok = false;
    result.errors.push(err.message || "An unknown error occurred.");
  }
  return result;
}

// --- 4. Ask RAG ---
export async function askHelpRag(question: string) {
  if (!(process.env.NEXT_PUBLIC_ENABLE_HELP_RAG === 'true')) {
    return { answer: FRIENDLY_ERROR_MSG, sources: [] };
  }
  if (!question.trim()) return { answer: "Please ask a question.", sources: [] };

  try {
    const db = getAdminDb();
    
    // 1. Embed the User's Question (This uses your fixed direct-fetch function)
    const questionEmbeddingResult = await embedText(question);
    
    if (!questionEmbeddingResult.ok) {
        console.error("Embedding failed during ASK:", questionEmbeddingResult.error);
        return { answer: "I'm having trouble analyzing your question. Please try again.", sources: [] };
    }
    
    const questionEmbedding = questionEmbeddingResult.embedding;
    
    // 2. Retrieve Articles from Firestore
    const snapshot = await db.collection('help_articles').where('enabled', '==', true).get();

    if (snapshot.empty) {
      return { answer: "The knowledge base is empty. Please ask an admin to generate content.", sources: [] };
    }

    const allArticles = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(doc => doc.title && doc.body) as HelpArticle[];

    // 3. Find the most relevant articles (Vector Search)
    const sources = retrieveTopK(questionEmbedding, allArticles, 5);

    if (sources.length === 0) {
      return { answer: "Sorry, I couldn't find any relevant help articles for your question.", sources: [] };
    }

    // 4. Construct the Prompt
    const context = sources.map((s, i) => `Source ${i+1}: ${s.title}\n${s.body}`).join('\n\n---\n\n');
    const systemPrompt = `You are a helpful AI assistant for FiscalFlow. Answer the user's question based ONLY on the provided sources below. If the answer isn't in the sources, say you don't know. Keep the answer concise and helpful.`;
    
    // 5. Generate Answer via Direct API Call (Bypassing Genkit)
    const apiKey = process.env.GEMINI_API_KEY;
    
    // UPDATED: Changed from 'gemini-1.5-flash' to 'gemini-2.5-flash'
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
      // Fallback if AI generation fails, but return sources so the user sees something
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
