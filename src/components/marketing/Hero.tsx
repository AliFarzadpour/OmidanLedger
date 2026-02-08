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
        <Card className="shadow-2xl">
          <CardHeader className="text-center p-6">
            <CardTitle className="text-2xl font-bold">6 Months of Free Early Access</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 p-6 pt-0">
            <ul className="space-y-3 text-left">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-1 shrink-0" />
                  <span>Unlimited properties and units</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-1 shrink-0" />
                  <span>Unlimited bank and credit card connections</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-1 shrink-0" />
                  <span>Full access to all current and future features</span>
                </li>
                 <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-1 shrink-0" />
                  <span>Founding-member lifetime discount</span>
                </li>
            </ul>
            <div className="text-xs text-muted-foreground flex items-center justify-center gap-4 pt-4 border-t">
                <ShieldCheck className="h-4 w-4" />
                <span>Powered by Plaid</span>
                <span>Bank-level encryption</span>
                <span>We never store credentials</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
