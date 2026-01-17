import 'server-only';

import { ai } from '@/ai/genkit';
import { getAdminDb } from '@/lib/firebaseAdmin';

type HelpArticle = {
  id: string;
  title: string;
  category?: string;
  body: string;
  tags?: string[];
  embedding?: number[];
  updatedAt?: any;
};

function cosineSimilarity(a: number[], b: number[]) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Uses a small, safe embedding model. If your Genkit plugin supports a different one,
// we can swap it later without changing app behavior.
async function embedText(text: string): Promise<number[]> {
  // Genkit embeddings API varies slightly by version.
  // This pattern works in many setups; adjust if your local typings differ.
  const res: any = await ai.embed({
    model: 'googleai/text-embedding-004',
    content: text,
  });
  // Normalize common return shapes
  const v =
    res?.embedding?.values ??
    res?.embedding ??
    res?.[0]?.embedding?.values ??
    res?.[0]?.embedding ??
    null;

  if (!Array.isArray(v)) {
    throw new Error('Embedding model did not return a numeric vector.');
  }
  return v as number[];
}

export async function indexMissingHelpEmbeddings(options?: { limit?: number }) {
  const db = getAdminDb();
  const limit = options?.limit ?? 200;

  const snap = await db.collection('help_articles').limit(limit).get();
  let updated = 0;

  for (const doc of snap.docs) {
    const data = doc.data() as Omit<HelpArticle, 'id'>;
    const needsEmbedding =
      !data.embedding || !Array.isArray(data.embedding) || data.embedding.length < 10;

    if (!needsEmbedding) continue;

    const text = `${data.title}\n\n${data.body}\n\nTags: ${(data.tags || []).join(', ')}`;
    const embedding = await embedText(text);

    await doc.ref.set(
      {
        embedding,
        updatedAt: new Date(),
      },
      { merge: true }
    );

    updated++;
  }

  return { updated };
}

export async function answerHelpQuestion(question: string) {
  const db = getAdminDb();

  // 1) Embed question
  const qVec = await embedText(question);

  // 2) Pull articles (for a few hundred/thousand docs this is OK)
  // If corpus grows large, we’ll upgrade to a real vector index later.
  const snap = await db.collection('help_articles').get();

  const articles: HelpArticle[] = snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      id: d.id,
      title: data.title,
      category: data.category,
      body: data.body,
      tags: data.tags,
      embedding: data.embedding,
      updatedAt: data.updatedAt,
    };
  });

  // 3) Score + pick top K with embeddings
  const scored = articles
    .filter((a) => Array.isArray(a.embedding) && (a.embedding as number[]).length > 10)
    .map((a) => ({
      ...a,
      score: cosineSimilarity(qVec, a.embedding as number[]),
    }))
    .sort((x, y) => y.score - x.score)
    .slice(0, 5);

  // 4) Build grounded context
  const context = scored
    .map(
      (a, idx) =>
        `SOURCE ${idx + 1}: ${a.title}\nCategory: ${a.category || 'General'}\n${a.body}`
    )
    .join('\n\n---\n\n');

  // 5) Generate answer grounded in sources
  const prompt = `
You are the OmidanLedger in-app Help Assistant.
Answer the user's question using ONLY the provided sources.
If the sources do not contain the answer, say you don’t have enough info and suggest what page/feature to check.

User question:
${question}

Sources:
${context}

Return:
1) A clear answer (short, step-by-step).
2) Mention the relevant page(s) in the app when possible (Dashboard, Transactions, Reports, etc).
`;

  const completion: any = await ai.generate({
    prompt,
    // model already configured in ai instance, but can be overridden
  });

  const text =
    completion?.text ??
    completion?.outputText ??
    completion?.output ??
    'Sorry — I could not generate a response.';

  const sources = scored.map((s) => ({
    id: s.id,
    title: s.title,
    category: s.category || 'General',
    score: s.score,
  }));

  return { answer: text, sources };
}
