'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Home, Users, Banknote, PieChart, Plus, DollarSign, Receipt, FileText, Lock } from 'lucide-react';
import { AddPropertyModal } from './sales/AddPropertyModal';
import Link from 'next/link';

function ChecklistItem({ children, isCompleted = false, icon: Icon }: { children: React.ReactNode, isCompleted?: boolean, icon: React.ElementType }) {
    return (
        <div className="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-100 transition-colors">
            <div className={`p-2 rounded-full ${isCompleted ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
                <Icon className="h-5 w-5" />
            </div>
            <span className={`text-slate-700 font-medium ${isCompleted ? 'line-through text-slate-400' : ''}`}>
                {children}
            </span>
        </div>
    );
}

export function OnboardingDashboard() {
  const router = useRouter();

  const checklistItems = [
    { text: 'Add your first property', href: '/dashboard/properties', icon: Home, isCompleted: false },
    { text: 'Add units or tenants', href: '/dashboard/properties', icon: Users, isCompleted: false },
    { text: 'Connect a bank account (optional)', href: '/dashboard/transactions', icon: Banknote, isCompleted: false },
    { text: 'Review your first report', href: '/dashboard/reports', icon: PieChart, isCompleted: false },
  ];

  return (
    <div className="p-8 max-w-4xl mx-auto bg-gradient-to-b from-slate-50 to-white min-h-full">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome to Omidan Ledger
        </h1>
        <p className="text-muted-foreground mt-2 max-w-lg mx-auto">
          Let’s get your property finances set up so rent and reports stay organized.
        </p>
         <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
          Setup in progress
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-10 items-start">
        {/* Left Column: Checklist */}
        <Card className="bg-white/80 shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle>Get set up in minutes</CardTitle>
            <CardDescription>0 of 4 completed</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {checklistItems.map((item, index) => (
              <Link href={item.href} key={index}>
                  <ChecklistItem icon={item.icon} isCompleted={item.isCompleted}>
                      {item.text}
                  </ChecklistItem>
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* Right Column: CTA and Preview */}
        <div className="space-y-8">
            <div className="text-center md:text-left">
                 <AddPropertyModal buttonContent={
                    <>
                        <Plus className="mr-2 h-4 w-4" /> Add your first property
                    </>
                 } />
            </div>

            <Card className="border-dashed">
                <CardHeader>
                    <CardTitle>What You’ll See Here</CardTitle>
                    <CardDescription>
                        Once you’re set up, your dashboard will come to life with:
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                   <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <DollarSign className="h-4 w-4 text-green-500"/>
                        <span>Monthly rent collected</span>
                   </div>
                   <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <Receipt className="h-4 w-4 text-blue-500"/>
                        <span>Expenses by property</span>
                   </div>
                   <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <FileText className="h-4 w-4 text-slate-500"/>
                        <span>Tax-ready reports</span>
                   </div>
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
