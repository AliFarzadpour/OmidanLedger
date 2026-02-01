import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { Header } from '@/components/marketing/Header';
import { Footer } from '@/components/marketing/Footer';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Free Early Access | OmidanLedger',
    description: 'Join the OmidanLedger early access program and get 6 months free. Help shape the future of landlord financial management.',
};

export default function EarlyAccessPage() {
    return (
        <div className="bg-slate-50 min-h-screen flex flex-col">
            <Header />
            <main className="flex-1 flex items-center justify-center py-12 px-4">
                <Card className="max-w-2xl w-full shadow-2xl animate-in fade-in-50 zoom-in-95">
                    <CardHeader className="text-center p-8">
                        <CardTitle className="text-4xl font-bold tracking-tight text-slate-900">
                            Join the Early User Program
                        </CardTitle>
                        <CardDescription className="text-lg text-slate-600 mt-3 max-w-md mx-auto">
                            Get <span className="font-bold text-primary">6 Months of OmidanLedger Completely Free</span> as a thank you for helping us build the best financial tool for landlords.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="px-8 pb-8 space-y-6">
                        <div className="space-y-4 text-slate-700">
                            <h3 className="font-semibold text-lg">What You Get:</h3>
                            <ul className="space-y-3">
                                <li className="flex items-start gap-3">
                                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                                    <div>
                                        <span className="font-semibold">Full Access, No Limits:</span> Use every feature, connect unlimited bank accounts, and manage your entire portfolio.
                                    </div>
                                </li>
                                <li className="flex items-start gap-3">
                                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                                    <div>
                                        <span className="font-semibold">Direct Impact:</span> Your feedback will directly shape our product roadmap. You'll be building the tool you want to use.
                                    </div>
                                </li>
                                <li className="flex items-start gap-3">
                                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                                    <div>
                                        <span className="font-semibold">Lifetime Discount:</span> After your 6 free months, lock in a permanent 50% discount on any future plan.
                                    </div>
                                </li>
                            </ul>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg text-center">
                            <h4 className="font-bold text-blue-800">Your Only Obligation: Feedback</h4>
                            <p className="text-sm text-blue-700 mt-1">
                                We just ask that you use the app and share your thoughts. That’s it. No credit card required. No hidden fees.
                            </p>
                        </div>
                        <Button asChild size="lg" className="w-full text-lg h-12 shadow-lg">
                            <Link href="/signup">
                                Get Your Free 6 Months
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            </main>
            <Footer />
        </div>
    );
}
