import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Home } from 'lucide-react';
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
            Stop Guessing. <br />
            Know Your Numbers.
          </h1>
          <p className="text-lg md:text-xl text-slate-600 max-w-2xl">
            OmidanLedger is the financial dashboard built exclusively for landlords. Ditch spreadsheet chaos and see your portfolio’s real performance — anytime.
          </p>
          <ul className="space-y-3 text-md text-slate-700">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span>Automate bookkeeping with secure bank connections</span>
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
              <p className="text-sm text-muted-foreground mt-2">6 months free • No credit card required</p>
          </div>
        </div>
        <Card className="shadow-2xl">
          <CardHeader className="text-center p-6">
            <div className="mx-auto w-fit bg-primary/10 p-3 rounded-full mb-3">
                <Home className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold">Join Our Free Early Access</CardTitle>
            <CardDescription className="text-base">
                Get 6 months of OmidanLedger for free by joining our early user program.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-0 text-center">
            <Button asChild size="lg" className="w-full h-12 text-lg">
              <Link href="/early-access">Join Free Early Access</Link>
            </Button>
            <p className="text-sm text-muted-foreground mt-2">6 months free • No credit card required</p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
