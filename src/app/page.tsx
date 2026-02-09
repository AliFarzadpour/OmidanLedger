
'use client';

import { Hero } from '@/components/marketing/Hero';
import { Features } from '@/components/marketing/Features';
import { HowItWorks } from '@/components/marketing/HowItWorks';
import { Testimonials } from '@/components/marketing/Testimonials';
import { FAQ } from '@/components/marketing/FAQ';
import { Footer } from '@/components/marketing/Footer';
import { Header } from '@/components/marketing/Header';
import { EarlyAccessStrip } from '@/components/marketing/EarlyAccessStrip';
import { Pricing } from '@/components/marketing/Pricing';
import { FinalCTA } from '@/components/marketing/FinalCTA';
import { useState } from 'react';
import { askHelpRag } from '@/actions/help-actions';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, BrainCircuit } from 'lucide-react';
import { marked } from 'marked';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const HERO_AI_VIDEO_URL =
  "https://firebasestorage.googleapis.com/v0/b/studio-7576922301-bac28.firebasestorage.app/o/logos%2FVideo_Generation_for_Fintech_AI.mp4?alt=media&token=7ff46a59-69ff-421f-b6b3-c27b815dbb03";

// Copied from help-assistant.tsx to render markdown and images
function AnswerRenderer({ content }: { content: string }) {
  if (!content) return null;

  const parts = content.split(/(\[IMAGE:.*?\])/g);

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none text-slate-700">
      {parts.map((part, index) => {
        const imageMatch = part.match(/\[IMAGE:(.*?)\]/);
        if (imageMatch) {
          const imageUrl = imageMatch[1].trim();
          return (
            <div key={index} className="my-4 rounded-lg border overflow-hidden">
              <Image
                src={imageUrl}
                alt="Help assistant image"
                width={500}
                height={300}
                className="w-full h-auto"
              />
            </div>
          );
        } else {
          return <div key={index} dangerouslySetInnerHTML={{ __html: marked.parse(part) }} />;
        }
      })}
    </div>
  );
}

export default function MarketingHomePage() {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<any[]>([]);
  const { toast } = useToast();

  const handleAsk = async () => {
    if (!query.trim()) {
      toast({
        variant: 'destructive',
        title: 'Please enter a question.',
      });
      return;
    }
    setIsLoading(true);
    setAnswer(null);
    setSources([]);
    try {
      const result = await askHelpRag(query);
      setAnswer(result.answer);
      setSources(result.sources);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white text-slate-800">
      <Header />
      <main>
        <Hero />

        {/* --- AI INVITE (ABOVE THE FOLD) --- */}
        <section id="ai-invite" className="mx-auto mt-8 mb-12 w-full max-w-6xl px-4">
          <Card className="grid gap-6 p-8 md:grid-cols-2 md:items-center shadow-2xl">
            {/* Left: AI prompt */}
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-primary">
                  Instant answers
                </p>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                  Ask the OmidanLedger AI anything
                </h2>
                <p className="text-sm text-muted-foreground">
                  Questions about security, reports, setup, pricing—ask here and get a clear answer.
                </p>
              </div>

              {/* Input + button */}
               <div className="flex flex-col gap-3 rounded-lg border bg-slate-50 p-3 focus-within:ring-2 focus-within:ring-ring">
                <input
                  className="h-11 w-full rounded-md border-0 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
                  placeholder='Try: "Is Plaid read-only and secure?"'
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAsk(); } }}
                  disabled={isLoading}
                />
                <Button
                  onClick={handleAsk}
                  disabled={isLoading}
                  type="button"
                >
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  Ask AI
                </Button>
              </div>

              {/* Sample questions */}
              <div className="flex flex-wrap gap-2">
                {[
                  "Is my bank data safe and secure?",
                  "Can it handle multiple properties and LLCs?",
                  "What tax reports do I get (Schedule E)?",
                  "Can I export reports for my CPA?",
                ].map((q) => (
                  <button
                    key={q}
                    type="button"
                    className="rounded-full border bg-white px-3 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                    onClick={() => setQuery(q)}
                    disabled={isLoading}
                  >
                    {q}
                  </button>
                ))}
              </div>

              <p className="text-xs text-muted-foreground">
                Tip: Ask about your exact situation (units, LLCs, bank accounts). The AI will guide you.
              </p>
            </div>

            {/* Right: Video */}
            <div className="overflow-hidden rounded-xl">
              <div className="aspect-video w-full">
                <video
                  className="h-full w-full object-cover"
                  src={HERO_AI_VIDEO_URL}
                  controls
                  playsInline
                  preload="metadata"
                />
              </div>
              <div className="bg-slate-900 px-4 py-3 text-white">
                <p className="text-sm font-medium">Not sure if it fits your rentals?</p>
                <p className="text-xs text-slate-300">
                  Ask a question above—get a direct answer in seconds.
                </p>
              </div>
            </div>
          </Card>
        </section>
        
        {/* AI Response Area */}
        {isLoading && (
            <div className="mx-auto w-full max-w-6xl px-4 mb-12">
                <Card>
                    <CardContent className="flex flex-col items-center justify-center h-48 gap-3 text-center">
                        <Loader2 className="h-8 w-8 text-primary animate-spin" />
                        <p className="text-muted-foreground">Our AI is thinking...</p>
                    </CardContent>
                </Card>
            </div>
        )}

        {answer && (
            <section className="mx-auto w-full max-w-6xl px-4 animate-in fade-in-50 mb-12">
                <Card className="bg-blue-50/50 border-blue-100">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-blue-900 flex items-center gap-2">
                            <BrainCircuit className="h-5 w-5 text-blue-600" /> Answer from Omidan AI
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <AnswerRenderer content={answer} />
                        {sources.length > 0 && (
                            <div className="pt-3 border-t border-blue-200">
                                <p className="text-xs font-semibold text-blue-800 mb-2">Sources:</p>
                                <div className="flex flex-wrap gap-2">
                                    {sources.map((s, i) => (
                                        <Badge key={i} variant="secondary" className="bg-white hover:bg-white text-[10px] text-slate-600 border-blue-200">
                                            {s.title}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </section>
        )}

        <EarlyAccessStrip />
        <Features />
        <HowItWorks />
        <Testimonials />
        <Pricing />

        {/* --- AI STRIP (BEFORE FAQ) --- */}
        <section className="mx-auto mt-12 mb-16 w-full max-w-6xl px-4">
          <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border bg-background p-6 shadow-xl sm:flex-row sm:items-center">
            <div>
              <h3 className="text-lg font-semibold">Have a specific question?</h3>
              <p className="text-sm text-muted-foreground">
                Ask the AI assistant instead of searching—get the answer instantly.
              </p>
            </div>
            <button
              className="h-11 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90"
              type="button"
              onClick={() => {
                const el = document.getElementById("ai-invite");
                el?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              Ask AI
            </button>
          </div>
        </section>

        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
