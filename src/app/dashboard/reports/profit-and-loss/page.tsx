'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { ProfitAndLossReport } from '@/components/dashboard/reports/profit-and-loss-report';

export default function ProfitAndLossPage() {
  const router = useRouter();

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Profit & Loss</h1>
          <p className="text-muted-foreground">Review your income, expenses, and profitability.</p>
        </div>
      </div>
      <ProfitAndLossReport />
    </div>
  );
}
