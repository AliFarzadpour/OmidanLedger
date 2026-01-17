'use server';

import type { DocumentData } from 'firebase-admin/firestore';

export type HelpArticle = DocumentData & {
  id: string;
  title: string;
  body: string;
  embedding: number[];
  category?: string;
  tags?: string[];
  score?: number;
};

/**
 * Calculates the cosine similarity between two vectors.
 * @param a - The first vector.
 * @param b - The second vector.
 * @returns The cosine similarity score (0 to 1).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) {
    return 0;
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  const magnitudeProduct = Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB);
  if (magnitudeProduct === 0) {
    return 0;
  }

  return dotProduct / magnitudeProduct;
}

/**
 * Retrieves the top K most relevant help articles based on cosine similarity.
 * @param questionEmbedding - The vector embedding of the user's question.
 * @param allArticles - An array of all help articles to search through.
 * @param k - The number of top articles to return.
 * @returns An array of the top K articles, sorted by relevance.
 */
export function retrieveTopK(
  questionEmbedding: number[],
  allArticles: HelpArticle[],
  k: number = 5
): HelpArticle[] {
  if (!questionEmbedding || allArticles.length === 0) {
    return [];
  }

  const scoredArticles = allArticles
    .filter(article => Array.isArray(article.embedding) && article.embedding.length > 0)
    .map(article => ({
      ...article,
      score: cosineSimilarity(questionEmbedding, article.embedding),
    }))
    .sort((a, b) => b.score - a.score);

  return scoredArticles.slice(0, k);
}
