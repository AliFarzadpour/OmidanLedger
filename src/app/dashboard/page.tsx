'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, collectionGroup, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/dashboard/stat-card';
import { ExpenseChart } from '@/components/dashboard/expense-chart';
import { RecentTransactions } from '@/components/dashboard/recent-transactions';
import { DollarSign, CreditCard, Activity, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function DashboardPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [debugStatus, setDebugStatus] = useState<string>('Initializing...');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ---------------------------------------------------------------------------
  // 🔍 DIAGNOSTIC FETCHER
  // ---------------------------------------------------------------------------
  useEffect(() => {
    async function runDiagnostics() {
      if (!user || !firestore) return;
      setIsLoading(true);
      setDebugStatus('Starting diagnostics...');

      try {
        // STEP 1: Try the Global Query (The one we want to work)
        // We removed the date filter to simplify it for this test.
        const globalQuery = query(
          collectionGroup(firestore, 'transactions'),
          where('userId', '==', user.uid),
          orderBy('date', 'desc')
        );

        const globalSnap = await getDocs(globalQuery);
        console.log(`[Global Query] Found ${globalSnap.size} docs.`);

        if (!globalSnap.empty) {
          setDebugStatus(`✅ SUCCESS: Found ${globalSnap.size} transactions via Global Query.`);
          const data = globalSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          setTransactions(data);
          setIsLoading(false);
          return;
        }

        // STEP 2: If Global failed, try "Direct Path" (Drilling down manually)
        // This verifies if the data exists but the "Collection Group" index/rule is blocking it.
        setDebugStatus('⚠️ Global query empty. Attempting Direct Path search...');
        
        // A. Get Bank Accounts first
        const banksRef = collection(firestore, 'users', user.uid, 'bankAccounts');
        const banksSnap = await getDocs(banksRef);

        if (banksSnap.empty) {
          setDebugStatus('❌ ERROR: No Bank Accounts found. Please add a bank account first.');
          setIsLoading(false);
          return;
        }

        // B. Search inside the first bank account found
        let foundDocs: any[] = [];
        for (const bankDoc of banksSnap.docs) {
          const txRef = collection(firestore, 'users', user.uid, 'bankAccounts', bankDoc.id, 'transactions');
          // Simple fetch without ordering to test raw access
          const txSnap = await getDocs(txRef);
          if (!txSnap.empty) {
            const docs = txSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            foundDocs = [...foundDocs, ...docs];
          }
        }

        if (foundDocs.length > 0) {
          setDebugStatus(`⚠️ PARTIAL SUCCESS: Found ${foundDocs.length} docs via Direct Path, but Global Query failed. This means your Index or Security Rule is still stuck.`);
          setTransactions(foundDocs);
        } else {
          setDebugStatus('❌ NO DATA: Found Bank Account, but it has 0 transactions inside.');
        }

      } catch (err: any) {
        console.error("Diagnostic Error:", err);
        setDebugStatus(`❌ CRITICAL ERROR: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    }

    runDiagnostics();
  }, [user, firestore]);

  // ---------------------------------------------------------------------------
  // CALCULATIONS (Simplified for Debugging)
  // ---------------------------------------------------------------------------
  const stats = transactions.reduce((acc, tx) => {
    const amt = Number(tx.amount) || 0;
    if (amt > 0) acc.income += amt;
    else {
      acc.expenses += amt;
      const cat = tx.primaryCategory || 'Uncategorized';
      acc.breakdown[cat] = (acc.breakdown[cat] || 0) + Math.abs(amt);
    }
    return acc;
  }, { income: 0, expenses: 0, breakdown: {} as Record<string, number> });

  const expenseData = Object.entries(stats.breakdown)
    .map(([name, value]) => ({ name, value: Number(value) }))
    .sort((a, b) => b.value - a.value);

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Financial Dashboard</h1>
        
        {/* DIAGNOSTIC PANEL */}
        <Alert variant={debugStatus.includes('✅') ? 'default' : 'destructive'} className={debugStatus.includes('✅') ? "bg-green-50 border-green-200" : "bg-yellow-50 border-yellow-200"}>
          {debugStatus.includes('✅') ? <CheckCircle2 className="h-4 w-4 text-green-600"/> : <AlertTriangle className="h-4 w-4 text-yellow-600"/>}
          <AlertTitle className={debugStatus.includes('✅') ? "text-green-800" : "text-yellow-800"}>
            Diagnostic Status
          </AlertTitle>
          <AlertDescription className="mt-2 font-mono text-xs">
            {debugStatus}
            <br/>
            Logged In User: {user?.uid}
          </AlertDescription>
        </Alert>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Net Income" value={stats.income + stats.expenses} icon={<Activity className="h-6 w-6 text-primary" />} isLoading={isLoading} />
        <StatCard title="Total Income" value={stats.income} icon={<DollarSign className="h-6 w-6 text-green-500" />} isLoading={isLoading} />
        <StatCard title="Total Expenses" value={stats.expenses} icon={<CreditCard className="h-6 w-6 text-red-500" />} isLoading={isLoading} />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <ExpenseChart data={expenseData} isLoading={isLoading} />
        </div>
        <div className="lg-col-span-3">
          <RecentTransactions transactions={transactions} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
}
