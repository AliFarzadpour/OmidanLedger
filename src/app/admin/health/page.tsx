'use server';

import { db } from '@/lib/admin-db';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default async function SystemHealthPage() {
  // Fetch all bank accounts across the system to check sync status
  const accountsSnap = await db.collectionGroup('bankAccounts').get();
  
  // An "issue" is defined as an account that is still pending its initial historical data sync.
  const issues = accountsSnap.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter((acc: any) => acc.historicalDataPending === true);

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Plaid Connection Health</h1>
      <p className="text-muted-foreground">
        This page scans for Plaid connections that are pending their initial historical sync. If an account stays in this state for a long time, it may indicate a problem.
      </p>
      
      {issues.length === 0 ? (
        <div className="flex items-center gap-3 p-4 bg-green-50 text-green-800 border border-green-200 rounded-lg">
          <CheckCircle2 className="h-6 w-6" />
          <div>
            <h3 className="font-semibold">All Systems Healthy</h3>
            <p className="text-sm">All connected bank accounts appear to be syncing correctly.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg">
            <AlertCircle className="h-6 w-6" />
            <div>
                <h3 className="font-semibold">{issues.length} Account(s) Pending Sync</h3>
                <p className="text-sm">These accounts have not yet completed their initial large transaction import.</p>
            </div>
          </div>
          <div className="grid gap-4">
            {issues.map((issue: any) => (
              <div key={issue.id} className="flex items-center justify-between p-4 bg-white border rounded-lg shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-slate-100 rounded-md">
                     <AlertCircle className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{issue.bankName}</p>
                    <p className="text-sm text-muted-foreground">User: <span className="font-mono text-xs">{issue.userId}</span></p>
                  </div>
                </div>
                <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200">
                    Sync Pending
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
