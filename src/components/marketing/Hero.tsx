import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export function Hero() {
  return (
    <section className="bg-slate-50/50">
      <div className="container mx-auto grid lg:grid-cols-2 gap-12 items-center px-4 md:px-6 py-20 md:py-32">
        <div className="space-y-6">
           <span className="sr-only">
              OmidanLedger is an automated bookkeeping and financial dashboard application designed for real estate investors and landlords. It helps users track rental income, manage property expenses, and generate financial reports to understand portfolio performance.
            </span>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter text-slate-900">
            See Your Rental Cash Flow in Real Time — Without Spreadsheets
          </h1>
          <p className="text-lg md:text-xl text-slate-600 max-w-2xl">
            OmidanLedger automatically organizes your rental income and expenses, shows property and portfolio performance, and generates tax-ready reports — all from your bank connections.
          </p>
          <ul className="space-y-3 text-md text-slate-700">
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
                <Link href="/early-access">Join Free Early Access</Link>
              </Button>
              <p className="text-sm text-muted-foreground mt-2">6 months free • No credit card required • Read-only bank access</p>
          </div>
        </div>
        <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-center text-slate-600">“Built for landlords who want clarity — not spreadsheets.”</p>
            <div className="rounded-lg overflow-hidden border-4 border-white shadow-2xl w-full">
                <video
                    src="https://firebasestorage.googleapis.com/v0/b/studio-7576922301-bac28.firebasestorage.app/o/logos%2FVideo_Generation_Request.mp4?alt=media&token=72b9c871-a465-40d1-9bd7-48caaeb2ccc7"
                    autoPlay
                    muted
                    loop
                    playsInline // Important for mobile browsers
                    className="w-full h-auto"
                />
            </div>
            <Button asChild size="lg" className="w-full mt-4 h-12 text-lg">
                <Link href="/early-access">Join Free Early Access</Link>
            </Button>
        </div>
      </div>
    </section>
  );
}
