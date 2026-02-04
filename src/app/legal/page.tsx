
import { Header } from '@/components/marketing/Header';
import { Footer } from '@/components/marketing/Footer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Legal Information | OmidanLedger',
    description: 'View our Privacy Policy, Terms of Service, and other legal notices.',
};

export default function LegalPage() {
  const legalLinks = [
    { href: '/privacy', title: 'Privacy Policy', description: 'How we handle your data.' },
    { href: '/disclaimer', title: 'Disclaimer', description: 'Important limitations of our service.' },
    { href: '#', title: 'Terms of Service', description: 'The rules for using our application.' },
  ];

  return (
    <div className="bg-slate-50 min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 py-20 px-4">
        <div className="container mx-auto max-w-3xl">
          <Card className="shadow-lg">
            <CardHeader className="text-center p-8">
              <CardTitle className="text-4xl font-bold tracking-tight text-slate-900">
                Legal Center
              </CardTitle>
              <CardDescription>
                Review our policies and terms governing the use of OmidanLedger.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-8 pb-8 space-y-4">
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold">Key Documents</h2>
                <p className="text-slate-600">
                  Please review the following documents carefully to understand your rights and responsibilities when using our service.
                </p>
              </div>
              <div className="space-y-3 pt-4">
                {legalLinks.map(link => (
                  <Link href={link.href} key={link.href}>
                    <div className="block p-4 border rounded-lg hover:bg-slate-50 transition-colors">
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="font-semibold text-primary">{link.title}</h3>
                          <p className="text-sm text-muted-foreground">{link.description}</p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                  </Link>
                ))}
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
