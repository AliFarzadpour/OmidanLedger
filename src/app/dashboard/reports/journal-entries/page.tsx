'use client';

import { JournalEntriesReport } from '@/components/dashboard/reports/journal-entries-report';

export default function JournalEntriesPage() {
  return (
    <div className="flex flex-col gap-8">
       <div>
        <h1 className="text-3xl font-bold tracking-tight">Journal Entries</h1>
        <p className="text-muted-foreground">
          A chronological list of all manual journal entries.
        </p>
      </div>
      <JournalEntriesReport />
    </div>
  );
}
