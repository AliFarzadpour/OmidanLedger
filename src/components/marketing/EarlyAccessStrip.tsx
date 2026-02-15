
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export function EarlyAccessStrip() {
  return (
    <section id="early-access-strip" className="bg-primary/10 py-12">
      <div className="container mx-auto px-4 md:px-6 text-center">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Ready to Get Started?</h2>
        <p className="text-lg text-slate-600 mt-2 max-w-2xl mx-auto">
          Create your free account today and see your financial picture clearly in minutes. No credit card required.
        </p>
        <div className="mt-6">
          <Button asChild size="lg">
            <Link href="/signup">Start My Free Ledger</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
