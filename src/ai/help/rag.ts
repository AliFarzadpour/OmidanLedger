'use server';

import { ai } from '@/ai/genkit';
import { getAdminDb } from '@/lib/firebaseAdmin';

// 1. Function to generate embedding for a piece of text
export async function generateEmbedding(text: string): Promise<number[]> {
  const { embedding } = await ai.embed({
    model: 'googleai/embedding-004', // A standard embeddings model
    content: text,
  });
  return embedding;
}

// 2. Function to calculate cosine similarity between two vectors
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    return 0;
  }
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magnitudeA += vecA[i] * vecA[i];
    magnitudeB += vecB[i] * vecB[i];
  }
  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);
  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }
  return dotProduct / (magnitudeA * magnitudeB);
}

// 3. Function to find relevant articles
export async function findRelevantArticles(questionEmbedding: number[], limit = 5) {
  const db = getAdminDb();
  const articlesRef = db.collection('help_articles');
  const snapshot = await articlesRef.get();

  if (snapshot.empty) {
    return [];
  }

  const articlesWithSimilarity = snapshot.docs
    .map(doc => {
      const data = doc.data();
      // Ensure embedding exists and is a valid array of numbers
      if (Array.isArray(data.embedding) && data.embedding.length > 0) {
        const similarity = cosineSimilarity(questionEmbedding, data.embedding);
        return { ...data, id: doc.id, similarity };
      }
      return null;
    })
    .filter((item): item is Exclude<typeof item, null> => item !== null && item.similarity > 0.5); // Filter out nulls and low similarity scores

  // Sort by similarity score in descending order
  articlesWithSimilarity.sort((a, b) => b.similarity - a.similarity);

  return articlesWithSimilarity.slice(0, limit);
}


// 4. Function to generate a final answer using LLM
export async function generateAnswer(question: string, articles: any[]): Promise<string> {
  if (articles.length === 0) {
    return "I'm sorry, but I couldn't find any information in our help center that matches your question. Please try rephrasing your question or contact support for further assistance.";
  }

  const context = articles
    .map(article => `## ${article.title}\n${article.body}`)
    .join('\n\n---\n\n');

  const prompt = `
    You are a friendly and helpful support assistant for an application named OmidanLedger.
    Your task is to answer the user's question based *only* on the provided "Help Articles" context.

    **Instructions:**
    1.  Read the user's question and the context carefully.
    2.  Formulate a clear and concise answer using only the information from the articles.
    3.  If the context does not contain the answer, state that you couldn't find the information and suggest they rephrase their question.
    4.  Do not make up information or use any knowledge outside of the provided context.
    5.  At the end of your answer, you MUST cite the articles you used by listing their titles under a "Sources:" heading.

    ---
    **CONTEXT: HELP ARTICLES**
    ${context}
    ---

    **USER'S QUESTION:**
    ${question}
  `;

  const { text } = await ai.generate({ prompt });
  
  return text || "I am unable to provide an answer at this time.";
}
