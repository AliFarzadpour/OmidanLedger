'use client';

import { ChartOfAccountsReport } from '@/components/dashboard/reports/chart-of-accounts-report';

export default function ChartOfAccountsPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Chart of Accounts</h1>
        <p className="text-muted-foreground">
          A complete list of all accounts in your financial system.
        </p>
      </div>
      <ChartOfAccountsReport />
    </div>
  );
}
