import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export function Pricing() {
  return (
    <section id="pricing" className="py-20 md:py-32 bg-white">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Simple, Transparent Pricing</h2>
          <p className="text-lg text-slate-600">
            Join now to lock in exclusive benefits as a founding member.
          </p>
        </div>
        <div className="flex justify-center">
          <Card className="max-w-md w-full shadow-lg border-2 border-primary">
            <CardHeader className="text-center p-8 bg-slate-50/50">
              <CardTitle className="text-2xl font-bold text-primary">Early Adopter Plan</CardTitle>
              <div className="my-4">
                <span className="text-5xl font-extrabold">$0</span>
                <span className="text-slate-500">/ for 6 months</span>
              </div>
              <CardDescription>
                No credit card required. Your only payment is your valuable feedback.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <ul className="space-y-4 text-left">
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                  <span>Full access to all current and future features.</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                  <span>Unlimited properties, units, and bank connections.</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                  <span>Direct influence on our product roadmap.</span>
                </li>
                <li className="flex items-center gap-3 font-bold">
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                  <span>50% lifetime discount after the free period ends.</span>
                </li>
              </ul>
              <Button asChild size="lg" className="w-full text-lg h-12">
                <Link href="/signup">Claim Your Free 6 Months</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
