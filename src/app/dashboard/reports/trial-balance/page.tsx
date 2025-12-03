'use client';

import { TrialBalanceReport } from '@/components/dashboard/reports/trial-balance-report';

export default function TrialBalancePage() {
  return (
    <div className="flex flex-col gap-8">
       <div>
        <h1 className="text-3xl font-bold tracking-tight">Trial Balance</h1>
        <p className="text-muted-foreground">
          A summary of all account balances to verify debit and credit equality.
        </p>
      </div>
      <TrialBalanceReport />
    </div>
  );
}
