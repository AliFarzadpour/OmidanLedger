'use client';

import { useState } from 'react';
import { askHelp } from '@/actions/help-actions';

export default function HelpPage() {
  const [q, setQ] = useState('');
  const [answer, setAnswer] = useState<string>('');
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function onAsk() {
    setLoading(true);
    setAnswer('');
    setSources([]);
    try {
      const res = await askHelp(q);
      setAnswer(res.answer);
      setSources(res.sources || []);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-semibold">Help Assistant</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Ask questions about how to use OmidanLedger. Answers are grounded in your help articles.
      </p>

      <div className="mt-6 rounded-lg border p-4">
        <textarea
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Example: How do I connect my bank? Why is my income not matching?"
          className="w-full min-h-[120px] rounded-md border p-3"
        />
        <div className="mt-3 flex gap-2">
          <button
            onClick={onAsk}
            disabled={loading}
            className="px-4 py-2 rounded-md border bg-black text-white disabled:opacity-60"
          >
            {loading ? 'Asking…' : 'Ask'}
          </button>
        </div>
      </div>

      {answer && (
        <div className="mt-6 rounded-lg border p-4">
          <h2 className="font-medium">Answer</h2>
          <div className="mt-2 whitespace-pre-wrap text-sm">{answer}</div>

          {sources?.length > 0 && (
            <div className="mt-4">
              <div className="text-sm font-medium">Sources</div>
              <ul className="mt-2 text-sm list-disc ml-5">
                {sources.map((s) => (
                  <li key={s.id}>
                    {s.title} <span className="text-muted-foreground">({s.category})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
