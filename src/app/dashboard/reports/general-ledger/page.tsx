'use client';

import { GeneralLedgerReport } from '@/components/dashboard/reports/general-ledger-report';

export default function GeneralLedgerPage() {
  return (
    <div className="flex flex-col gap-8">
       <div>
        <h1 className="text-3xl font-bold tracking-tight">General Ledger</h1>
        <p className="text-muted-foreground">
          A detailed view of all transactions, grouped by account.
        </p>
      </div>
      <GeneralLedgerReport />
    </div>
  );
}
