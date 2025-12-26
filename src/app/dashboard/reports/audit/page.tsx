'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, getDocs } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FinancialIntegrityReport } from '@/components/dashboard/reports/audit/FinancialIntegrityReport';
import { TaxReadinessReport } from '@/components/dashboard/reports/audit/TaxReadinessReport';
import type { Transaction, AuditIssue } from '@/components/dashboard/reports/audit/types';
import { Loader2 } from 'lucide-react';


export default function FinancialAuditPage() {
  const { user } = useUser();
  const firestore = useFirestore();
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
      <Tabs defaultValue="integrity" className="p-8 max-w-6xl mx-auto space-y-6">
        <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="integrity">Financial Integrity</TabsTrigger>
            <TabsTrigger value="tax">Tax Readiness</TabsTrigger>
        </TabsList>
        <TabsContent value="integrity">
            <FinancialIntegrityReport transactions={allTransactions} onRefresh={runAudit} />
        </TabsContent>
        <TabsContent value="tax">
            <TaxReadinessReport transactions={allTransactions} />
        </TabsContent>
      </Tabs>
  );
}
