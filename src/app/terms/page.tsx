
import { Header } from '@/components/marketing/Header';
import { Footer } from '@/components/marketing/Footer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Terms of Service | OmidanLedger',
    description: 'Read the terms and conditions for using the OmidanLedger application.',
};


export default function TermsOfServicePage() {
  return (
    <div className="bg-slate-50 min-h-screen flex-col">
      <Header />
      <main className="flex-1 py-20 px-4">
        <div className="container mx-auto max-w-3xl">
          <Card className="shadow-lg">
            <CardHeader className="text-center p-8">
              <CardTitle className="text-4xl font-bold tracking-tight text-slate-900">
                Terms of Service
              </CardTitle>
               <CardDescription>
                Last updated: {new Date().toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-8 pb-8 space-y-6 text-slate-700">
              
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">1. Acceptance of Terms</h2>
                <p>
                  By accessing or using OmidanLedger (the "Service"), you agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree to these terms, please do not use the Service.
                </p>
              </div>

              <div className="space-y-2">
                <h2 className="text-xl font-semibold">2. Description of Service</h2>
                <p>
                  OmidanLedger provides a financial management and bookkeeping platform designed for real estate investors and landlords. The Service includes features for transaction tracking, report generation, and portfolio analysis.
                </p>
              </div>

              <div className="space-y-2">
                <h2 className="text-xl font-semibold">3. User Accounts</h2>
                <p>
                  You are responsible for maintaining the confidentiality of your account and password. You agree to accept responsibility for all activities that occur under your account. You must notify us immediately upon becoming aware of any breach of security or unauthorized use of your account.
                </p>
              </div>

              <div className="space-y-2">
                <h2 className="text-xl font-semibold">4. Use of the Service</h2>
                <p>
                  You agree not to use the Service for any unlawful purpose or in any way that could harm the Service or impair anyone else's use of it. You agree not to misuse our services by interfering with their normal operation, or attempting to access them using a method other than through the interfaces and instructions that we provide.
                </p>
              </div>

               <div className="space-y-2">
                <h2 className="text-xl font-semibold">5. Disclaimer of Warranties</h2>
                <p>
                  The Service is provided on an "as is" and "as available" basis. OmidanLedger makes no warranty that the service will meet your requirements, be uninterrupted, timely, secure, or error-free. Please refer to our full Disclaimer for more information.
                </p>
              </div>
              
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">6. Limitation of Liability</h2>
                <p>
                  In no event shall OmidanLedger, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Service.
                </p>
              </div>

              <div className="space-y-2">
                <h2 className="text-xl font-semibold">7. Changes to Terms</h2>
                <p>
                  We reserve the right, at our sole discretion, to modify or replace these Terms at any time. We will provide at least 30 days' notice before any new terms taking effect. By continuing to access or use our Service after those revisions become effective, you agree to be bound by the revised terms.
                </p>
              </div>

              <div className="text-center pt-10 mt-6 border-t">
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
