import { Button } from '@/components/ui/button';
import Link from 'next/link';

export function FinalCTA() {
  return (
    <section className="py-20 md:py-32 bg-slate-900 text-white">
      <div className="container mx-auto px-4 md:px-6 text-center">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Ready to Stop Guessing?</h2>
        <p className="text-lg text-slate-300 mt-4 max-w-2xl mx-auto">
          Get clear, landlord-ready books and real-time insight into your portfolio.
        </p>
        <div className="mt-8">
          <Button asChild size="lg" className="h-12 text-lg">
            <Link href="/early-access">Join Free Early Access</Link>
          </Button>
          <p className="text-sm text-slate-400 mt-2">6 months free • No credit card required</p>
        </div>
      </div>
    </section>
  );
}
