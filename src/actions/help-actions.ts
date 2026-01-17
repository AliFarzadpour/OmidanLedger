'use server';

import 'server-only';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { isHelpEnabled } from '@/lib/help/help-config';
import { isSuperAdmin } from '@/lib/auth-utils';
import { retrieveTopK, type HelpArticle } from '@/lib/help/help-retrieval';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

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

export async function generateHelpArticlesFromCodebase(userId: string) {
  // 1. Safety Checks
  if (!(process.env.NEXT_PUBLIC_ENABLE_HELP_RAG === 'true')) throw new Error(FRIENDLY_ERROR_MSG);
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured.");
  if (!await isSuperAdmin(userId)) throw new Error("Permission denied.");

  const db = getAdminDb();

  // 2. Clear existing articles (Optional but recommended)
  // You can do this manually in Firebase Console to be safe, or uncomment this to auto-delete:
  /*
  const existingDocs = await db.collection('help_articles').listDocuments();
  const deleteBatch = db.batch();
  existingDocs.forEach(doc => deleteBatch.delete(doc));
  await deleteBatch.commit();
  console.log("Cleared old help articles.");
  */

  // 3. Scan Codebase
  const srcDir = path.join(process.cwd(), 'src'); 
  let allCode = "";
  try {
    const files = readCodebase(srcDir);
    allCode = files.join('\n').substring(0, 2000000); // 2MB Limit
  } catch (err) {
    console.error("Error reading codebase:", err);
    throw new Error("Failed to read codebase files.");
  }

  // 4. The "Step-by-Step" Prompt
  const deepPrompt = `
    You are a technical documentation expert for 'FiscalFlow'. I have attached the source code.
    
    YOUR TASK:
    Generate 30-40 comprehensive help articles that explain EXACTLY how to use the app.
    
    CRITICAL WRITING STYLE:
    - **Step-by-Step**: Every article MUST use numbered lists (1., 2., 3.) for instructions.
    - **Directional**: Tell the user exactly where to click. (e.g., "Click the 'Add Property' button in the top right corner").
    - **No Fluff**: Avoid marketing language. Be direct.
    
    REQUIRED ARTICLE TYPES:
    - **Workflows**: "How to add a property", "How to reconcile a transaction", "How to generate a P&L report".
    - **Troubleshooting**: "What to do if Plaid sync fails", "Why is my balance not updating?".
    - **Features**: "How Smart Rules categorize your data automatically".

    OUTPUT FORMAT (JSON):
    Return a raw JSON object with an "articles" array. Each article has title, category, body (Markdown), and tags.
    
    SOURCE CODE CONTEXT:
    ${allCode}
  `;
  
  // 5. Generate with Gemini 1.5 Flash (Direct API)
  const apiKey = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [{ text: deepPrompt }]
        }],
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

    // 6. Save to Database
    const batch = db.batch();
    output.articles.forEach((article: any) => {
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
      const article = doc.data();
      if (!doc.exists || !article) {
        result.skipped++;
        continue;
      }
      
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
      
      if (combinedText.trim().length < MIN_CONTENT_LENGTH) {
        result.skipped++;
        continue;
      }


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

/**
 * Answers a user's question using the RAG pipeline with Direct API calls.
 */
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
    // Using gemini-1.5-flash for speed and reliability
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

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
