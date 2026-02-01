import { Button } from '@/components/ui/button';
import Link from 'next/link';

export function EarlyAccessStrip() {
  return (
    <section id="early-access-strip" className="bg-primary/10 py-12">
      <div className="container mx-auto px-4 md:px-6 text-center">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Join Our Free Early Access</h2>
        <p className="text-lg text-slate-600 mt-2 max-w-2xl mx-auto">
          Get 6 months of OmidanLedger free by joining our early user program. Help shape the product and lock in early-user benefits.
        </p>
        <div className="mt-6">
          <Button asChild size="lg">
            <Link href="/early-access">Join Free Early Access</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
