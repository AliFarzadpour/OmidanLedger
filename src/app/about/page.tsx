
import { Header } from '@/components/marketing/Header';
import { Footer } from '@/components/marketing/Footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'About OmidanLedger',
    description: 'Learn about our mission to simplify financial management for landlords and real estate investors.',
};

export default function AboutPage() {
  return (
    <div className="bg-slate-50 min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 py-20 px-4">
        <div className="container mx-auto max-w-3xl">
          <Card className="shadow-lg">
            <CardHeader className="text-center p-8">
              <CardTitle className="text-4xl font-bold tracking-tight text-slate-900">
                About OmidanLedger
              </CardTitle>
            </CardHeader>
            <CardContent className="px-8 pb-8 space-y-8 text-slate-700">
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold">Our Mission</h2>
                <p>
                  OmidanLedger was born from a simple idea: landlords and real estate investors deserve financial tools built for them. We got tired of fighting with generic accounting software and messy spreadsheets that weren't designed to track rental properties. Our mission is to provide a clear, automated, and intuitive platform that gives you confidence in your numbers and more time to grow your portfolio.
                </p>
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-semibold">Who We Are</h2>
                <p>
                  We are a small, dedicated team of developers and real estate enthusiasts who believe that powerful software should be accessible and easy to use. We're building OmidanLedger to solve the real-world problems we've faced ourselves as investors.
                </p>
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-semibold">Our Commitment to You</h2>
                <p>
                  Your trust is our top priority. We are committed to bank-level security for your financial data, a user-friendly experience, and building a product that evolves with your feedback. We're here to help you succeed.
                </p>
              </div>

              <div className="text-center pt-6 border-t">
                <p className="text-muted-foreground">
                  Questions? Email us at <a href="mailto:support@omidanledger.com" className="text-primary font-medium hover:underline">support@omidanledger.com</a>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
