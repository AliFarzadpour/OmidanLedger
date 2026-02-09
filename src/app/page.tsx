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

const HERO_AI_VIDEO_URL =
  "https://firebasestorage.googleapis.com/v0/b/studio-7576922301-bac28.firebasestorage.app/o/logos%2FAvatar_Reads_Script_Video_Generated.mp4?alt=media&token=52489cf9-a2a1-4068-8309-35f4deb93a67";


export default function MarketingHomePage() {
  return (
    <div className="bg-white text-slate-800">
      <Header />
      <main>
        <Hero />

        {/* --- AI INVITE (ABOVE THE FOLD) --- */}
        <section id="ai-invite" className="mx-auto mt-8 mb-12 w-full max-w-6xl px-4">
          <div className="grid gap-6 rounded-2xl border bg-background p-6 shadow-lg md:grid-cols-2 md:items-center">
            {/* Left: AI prompt */}
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Instant answers
                </p>
                <h2 className="text-2xl font-semibold tracking-tight">
                  Ask the OmidanLedger AI anything
                </h2>
                <p className="text-sm text-muted-foreground">
                  Questions about security, reports, setup, pricing—ask here and get a clear answer.
                </p>
              </div>

              {/* Input + button (wire to your AI help later) */}
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  className="h-11 w-full rounded-md border bg-background px-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder='Try: "Is Plaid read-only and secure?"'
                  // TODO: wire to your AI help endpoint
                />
                <button
                  className="h-11 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90"
                  // TODO: wire to your AI help endpoint
                  type="button"
                >
                  Ask AI
                </button>
              </div>

              {/* Sample questions (clickable pills - wire later) */}
              <div className="flex flex-wrap gap-2">
                {[
                  "Is Plaid read-only and secure?",
                  "Can it handle multiple properties and LLCs?",
                  "What tax reports do I get (Schedule E)?",
                  "How long does setup take?",
                  "Can I export reports for my CPA?",
                ].map((q) => (
                  <button
                    key={q}
                    type="button"
                    className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                    // TODO: set input value + submit to AI
                  >
                    {q}
                  </button>
                ))}
              </div>

              <p className="text-xs text-muted-foreground">
                Tip: Ask about your exact situation (units, LLCs, bank accounts). The AI will guide you.
              </p>
            </div>

            {/* Right: Video (your provided link) */}
            <div className="overflow-hidden rounded-xl border bg-muted">
              <div className="aspect-video w-full">
                <video
                  className="h-full w-full object-cover"
                  src={HERO_AI_VIDEO_URL}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                />
              </div>
              <div className="px-4 py-3">
                <p className="text-sm font-medium">Not sure if it fits your rentals?</p>
                <p className="text-xs text-muted-foreground">
                  Ask a question above—get a direct answer in seconds.
                </p>
              </div>
            </div>
          </div>
        </section>

        <EarlyAccessStrip />
        <Features />
        <HowItWorks />
        <Testimonials />
        <Pricing />

        {/* --- AI STRIP (BEFORE FAQ) --- */}
        <section className="mx-auto mt-12 w-full max-w-6xl px-4">
          <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border bg-background p-6 shadow-sm sm:flex-row sm:items-center">
            <div>
              <h3 className="text-lg font-semibold">Have a specific question?</h3>
              <p className="text-sm text-muted-foreground">
                Ask the AI assistant instead of searching—get the answer instantly.
              </p>
            </div>
            <button
              className="h-11 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90"
              type="button"
              // TODO: open the AI panel / scroll to AI section
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
