'use server';

import { getAdminDb } from '@/lib/firebaseAdmin';
import { generateEmbedding, findRelevantArticles, generateAnswer } from '@/ai/help/rag';
import { isSuperAdmin } from '@/lib/auth-utils';
import { WriteBatch } from 'firebase-admin/firestore';

/**
 * Main server action for the RAG help assistant.
 */
export async function askHelp(question: string): Promise<{ answer: string; sources: any[] }> {
  if (!question) {
    throw new Error('Question cannot be empty.');
  }

  try {
    const questionEmbedding = await generateEmbedding(question);
    const relevantArticles = await findRelevantArticles(questionEmbedding);
    const answer = await generateAnswer(question, relevantArticles);

    const sources = relevantArticles.map(article => ({
      id: article.id,
      title: article.title,
      category: article.category,
    }));

    return { answer, sources };
  } catch(error: any) {
    console.error("Error in askHelp action: ", error);
    throw new Error("Failed to get an answer from the AI assistant.");
  }
}

/**
 * Admin-only action to index help articles and create embeddings.
 */
export async function indexHelpArticles(userId: string): Promise<{ count: number }> {
    const isAdmin = await isSuperAdmin(userId);
    if (!isAdmin) {
        throw new Error("Permission Denied: This action is restricted to administrators.");
    }

    const db = getAdminDb();
    const articlesRef = db.collection('help_articles');
    const snapshot = await articlesRef.where('embedding', '==', []).get();

    if (snapshot.empty) {
        return { count: 0 };
    }

    let indexedCount = 0;
    const batch = db.batch();

    for (const doc of snapshot.docs) {
        const article = doc.data();
        const contentToIndex = `${article.title}\n${article.body}`;
        
        try {
            const embedding = await generateEmbedding(contentToIndex);
            batch.update(doc.ref, { embedding: embedding, updatedAt: new Date() });
            indexedCount++;
        } catch (error) {
            console.error(`Failed to generate embedding for article ${doc.id}:`, error);
        }
    }
    
    await batch.commit();

    return { count: indexedCount };
}
