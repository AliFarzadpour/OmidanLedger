'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Home, Users, Banknote, PieChart, Plus, DollarSign, Receipt, FileText, Lock } from 'lucide-react';
import { AddPropertyModal } from './sales/AddPropertyModal';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Updated Checklist Item to be a numbered step
function OnboardingStep({ 
  children, 
  stepNumber, 
  status,
  isClickable,
  onClick
}: { 
  children: React.ReactNode, 
  stepNumber: number, 
  status: 'next' | 'upcoming' | 'complete',
  isClickable?: boolean,
  onClick?: () => void
}) {
    const statusConfig = {
        next: {
            bgColor: 'bg-primary',
            textColor: 'text-primary-foreground',
            label: 'Next step',
        },
        upcoming: {
            bgColor: 'bg-slate-200',
            textColor: 'text-slate-500',
            label: '',
        },
        complete: {
            bgColor: 'bg-green-500',
            textColor: 'text-white',
            label: 'Completed',
        }
    };

    const currentStatus = statusConfig[status];

    const stepContent = (
      <div 
        className={cn(
            "flex items-center gap-4 p-4 rounded-lg transition-colors", 
            status === 'next' ? 'bg-blue-50 border border-blue-200' : 'bg-transparent',
            isClickable && status === 'next' ? 'cursor-pointer hover:bg-blue-100' : '',
            status === 'upcoming' ? 'cursor-not-allowed opacity-50' : 'opacity-90'
        )}
        onClick={onClick}
      >
          <div className={cn("flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center font-bold text-lg", currentStatus.bgColor, currentStatus.textColor)}>
              {stepNumber}
          </div>
          <div className="flex-1">
              <span className={cn("font-semibold", status === 'upcoming' ? 'text-slate-400' : 'text-slate-800')}>
                  {children}
              </span>
          </div>
          {status === 'next' && <span className="text-xs font-semibold text-primary uppercase tracking-wider">{currentStatus.label}</span>}
      </div>
    );
    
    if (status === 'upcoming') {
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div>{stepContent}</div>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Complete Step 1 first</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    return stepContent;
}

export function OnboardingDashboard() {
  const router = useRouter();

  // Based on your logic, the user is always on step 1 when this screen shows.
  const onboardingSteps = [
    { text: 'Add your first property', href: '/dashboard/properties', icon: Home, status: 'next' as const },
    { text: 'Add units or tenants', href: '/dashboard/properties', icon: Users, status: 'upcoming' as const },
    { text: 'Connect a bank account (optional)', href: '/dashboard/transactions', icon: Banknote, status: 'upcoming' as const },
    { text: 'Review your first report', href: '/dashboard/reports', icon: PieChart, status: 'upcoming' as const },
  ];
  
  const openAddPropertyModal = () => {
      // This is a bit of a trick. The modal is controlled by the AddPropertyModal component itself.
      // We find its trigger button and click it programmatically.
      const trigger = document.getElementById('add-property-modal-trigger');
      trigger?.click();
  };

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
        {/* Left Column: Checklist and CTA */}
        <div className="space-y-6">
            <Card className="bg-white/80 shadow-sm border-slate-200">
              <CardHeader>
                <CardTitle>Get set up in minutes</CardTitle>
                <CardDescription>
                    0 of 4 completed. 
                    <span className="text-slate-400"> Most landlords finish setup in under 5 minutes.</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {onboardingSteps.map((item, index) => (
                  <OnboardingStep 
                    key={index} 
                    stepNumber={index + 1} 
                    status={item.status}
                    isClickable={index === 0}
                    onClick={index === 0 ? openAddPropertyModal : undefined}
                  >
                      {item.text}
                  </OnboardingStep>
                ))}
              </CardContent>
            </Card>

             <div className="pl-4 hidden">
                 <AddPropertyModal 
                    buttonContent={
                        <>
                            <Plus className="mr-2 h-4 w-4" /> Add your first property
                        </>
                    }
                    triggerId="add-property-modal-trigger" // Add an ID to the trigger
                 />
            </div>
        </div>

        {/* Right Column: Preview */}
        <div className="space-y-8 md:pt-16">
            <Card className="border-dashed border-slate-300">
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
