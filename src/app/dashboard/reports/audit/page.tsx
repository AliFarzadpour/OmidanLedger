'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, getDocs } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FinancialIntegrityReport } from '@/components/dashboard/reports/audit/FinancialIntegrityReport';
import { TaxReadinessReport } from '@/components/dashboard/reports/audit/TaxReadinessReport';
import type { Transaction, AuditIssue } from '@/components/dashboard/reports/audit/types';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';


export default function FinancialAuditPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);

  const runAudit = useCallback(async () => {
      if (!user || !firestore) return;
      setLoading(true);
      
      try {
        const accountsSnap = await getDocs(collection(firestore, `users/${user.uid}/bankAccounts`));
        const fetchedTransactions: Transaction[] = [];

        for (const accountDoc of accountsSnap.docs) {
          const txSnap = await getDocs(collection(accountDoc.ref, 'transactions'));
          txSnap.forEach(txDoc => {
            fetchedTransactions.push({ 
                id: txDoc.id, 
                ...txDoc.data(),
                bankAccountId: accountDoc.id
            } as Transaction);
          });
        }
        setAllTransactions(fetchedTransactions);

      } catch (error) {
        console.error("Audit Error:", error);
      } finally {
        setLoading(false);
      }
    }, [user, firestore]);

  useEffect(() => {
    runAudit();
  }, [runAudit]);
  
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Auditing all transactions...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Financial Audit</h1>
          <p className="text-muted-foreground">Scan transactions for errors, inconsistencies, and tax readiness.</p>
        </div>
      </div>
      <Tabs defaultValue="integrity" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="integrity">Financial Integrity</TabsTrigger>
            <TabsTrigger value="tax">Tax Readiness</TabsTrigger>
        </TabsList>
        <TabsContent value="integrity" className="mt-6">
            <FinancialIntegrityReport transactions={allTransactions} onRefresh={runAudit} />
        </TabsContent>
        <TabsContent value="tax" className="mt-6">
            <TaxReadinessReport transactions={allTransactions} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
