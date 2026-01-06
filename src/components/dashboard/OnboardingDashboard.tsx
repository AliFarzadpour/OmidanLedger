
'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Banknote, Home, Lock } from 'lucide-react';
import { AddPropertyModal } from './sales/AddPropertyModal';
import Link from 'next/link';

function ChecklistItem({ children, isCompleted = false }: { children: React.ReactNode, isCompleted?: boolean }) {
    return (
        <div className="flex items-center gap-3">
            <Checkbox checked={isCompleted} className="border-slate-300" />
            <span className={`text-slate-600 ${isCompleted ? 'line-through text-slate-400' : ''}`}>
                {children}
            </span>
        </div>
    );
}

export function OnboardingDashboard() {
  const router = useRouter();

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome to Omidan Ledger
        </h1>
        <p className="text-muted-foreground mt-2">
          Let’s get your property finances set up so rent and reports stay organized.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-10 items-start">
        {/* Left Column: Checklist */}
        <Card className="bg-slate-50/50">
          <CardHeader>
            <CardTitle>Get set up in a few minutes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link href="/dashboard/properties">
                <ChecklistItem>Add your first property</ChecklistItem>
            </Link>
            <ChecklistItem>Add units or tenants</ChecklistItem>
            <Link href="/dashboard/transactions">
              <ChecklistItem>Connect a bank account (optional)</ChecklistItem>
            </Link>
             <Link href="/dashboard/reports">
                <ChecklistItem>Review your first report</ChecklistItem>
            </Link>
          </CardContent>
        </Card>

        {/* Right Column: CTA and Preview */}
        <div className="space-y-8">
            <div className="text-center md:text-left">
                <AddPropertyModal />
            </div>

            <Card className="border-dashed">
                <CardHeader>
                    <CardTitle>What You’ll See Here</CardTitle>
                    <CardDescription>
                        Once you’re set up, your dashboard will come to life with:
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                        <li>Monthly rent collected</li>
                        <li>Expenses by property</li>
                        <li>Tax-ready reports</li>
                    </ul>
                </CardContent>
            </Card>
        </div>
      </div>
      
      {/* Footer */}
       <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground pt-12 mt-10 border-t">
            <span className="flex items-center gap-1.5"><Lock className="h-4 w-4" /> Secure by Firebase</span>
            <span className="flex items-center gap-1.5"><Banknote className="h-4 w-4" /> Bank connections via Plaid</span>
            <span className="flex items-center gap-1.5"><Home className="h-4 w-4" /> Built for landlords and property owners</span>
        </div>
    </div>
  );
}
