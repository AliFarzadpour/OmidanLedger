'use client';

import { Button } from '@/components/ui/button';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export function Hero() {

  return (
    <section className="bg-slate-50/50">
      <div className="container mx-auto px-4 md:px-6 py-20 md:py-24 text-center">
        <div className="space-y-6 max-w-3xl mx-auto">
           <span className="sr-only">
              OmidanLedger is an automated bookkeeping and financial dashboard application designed for real estate investors and landlords. It helps users track rental income, manage property expenses, and generate financial reports to understand portfolio performance.
            </span>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter text-slate-900">
            Your Schedule E, Automated. Start Your Free Ledger.
          </h1>
          <p className="text-lg md:text-xl text-slate-600">
            Tax season is coming. Don't spend it digging through receipts. OmidanLedger organizes your rental income and expenses automatically.
          </p>
          <ul className="space-y-3 text-md text-slate-700 inline-block text-left">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span>Automate bookkeeping with secure, read-only bank connections</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span>Generate tax-ready rental reports in one click</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span>Make confident decisions with real-time portfolio data</span>
            </li>
          </ul>
           <div className="pt-4">
              <Button asChild size="lg" className="h-12 text-lg">
                <Link href="/signup">Start My Free Ledger</Link>
              </Button>
              <p className="text-sm text-muted-foreground mt-2">6 months free • No credit card required • Read-only bank access</p>
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-500">
                <ShieldCheck className="h-4 w-4 text-green-600" />
                <span>Bank-level security. Read-only access.</span>
              </div>
          </div>
        </div>
      </div>
    </section>
  );
}
