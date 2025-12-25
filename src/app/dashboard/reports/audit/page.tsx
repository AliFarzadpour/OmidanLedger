'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, getDocs, collectionGroup } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, AlertCircle, CheckCircle, ShieldAlert } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  categoryHierarchy?: {
    l0: string;
    l1: string;
    l2: string;
    l3: string;
  };
  bankAccountId: string; // Needed for updates
}

interface AuditIssue {
  type: 'mismatch' | 'uncategorized' | 'missing_hierarchy';
  message: string;
  transaction: Transaction;
}

export default function FinancialAuditPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [issues, setIssues] = useState<AuditIssue[]>([]);

  const runAudit = useCallback(async () => {
      if (!user || !firestore) return;
      setLoading(true);
      setIssues([]);
      
      try {
        const accountsSnap = await getDocs(collection(firestore, `users/${user.uid}/bankAccounts`));
        const allTransactions: Transaction[] = [];

        for (const accountDoc of accountsSnap.docs) {
          const txSnap = await getDocs(collection(accountDoc.ref, 'transactions'));
          txSnap.forEach(txDoc => {
            allTransactions.push({ 
                id: txDoc.id, 
                ...txDoc.data(),
                bankAccountId: accountDoc.id
            } as Transaction);
          });
        }
        
        const foundIssues: AuditIssue[] = [];
        allTransactions.forEach(tx => {
          const cats = tx.categoryHierarchy;
          
          // Check 1: Missing Hierarchy
          if (!cats || !cats.l0 || !cats.l2) {
            foundIssues.push({ type: 'missing_hierarchy', message: 'Category hierarchy is missing or incomplete.', transaction: tx });
            return; // Stop checking this tx if basic data is missing
          }

          // Check 2: Income/Expense Mismatch
          const isIncomeL0 = cats.l0?.toLowerCase().includes('income');
          const isExpenseL0 = cats.l0?.toLowerCase().includes('expense');
          
          if ((isIncomeL0 && tx.amount < 0) || (isExpenseL0 && tx.amount > 0)) {
            foundIssues.push({ type: 'mismatch', message: `Amount is ${tx.amount < 0 ? 'negative' : 'positive'} but category is ${cats.l0}.`, transaction: tx });
          }

          // Check 3: Uncategorized Items
          const isUncategorized = cats.l2?.toLowerCase().includes('uncategorized') || cats.l2?.toLowerCase().includes('needs review');
          if (isUncategorized) {
            foundIssues.push({ type: 'uncategorized', message: `Transaction is marked as '${cats.l2}'.`, transaction: tx });
          }
        });

        setIssues(foundIssues);

      } catch (error) {
        console.error("Audit Error:", error);
      } finally {
        setLoading(false);
      }
    }, [user, firestore]);

  useEffect(() => {
    runAudit();
  }, [runAudit]);

  const groupedIssues = useMemo(() => {
    return issues.reduce((acc, issue) => {
      if (!acc[issue.type]) {
        acc[issue.type] = [];
      }
      acc[issue.type].push(issue);
      return acc;
    }, {} as Record<string, AuditIssue[]>);
  }, [issues]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Auditing all transactions...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2">
           <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/reports')}>
              <ArrowLeft className="h-5 w-5" />
           </Button>
            <div className="flex items-center gap-3">
                <ShieldAlert className="h-8 w-8 text-primary" />
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Financial Audit Report</h1>
                    <p className="text-muted-foreground">Found {issues.length} potential issues across all accounts.</p>
                </div>
            </div>
        </div>
        <Button onClick={runAudit} variant="outline" disabled={loading}>
            <Loader2 className={`mr-2 h-4 w-4 ${!loading && 'hidden'}`} />
            Re-run Audit
        </Button>
      </div>
      
      {issues.length === 0 ? (
        <Card className="text-center py-20 bg-green-50/50 border-green-200">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <CardTitle className="text-xl text-green-800">No Issues Found!</CardTitle>
            <CardDescription className="text-green-700">Your transaction data appears to be consistent.</CardDescription>
        </Card>
      ) : (
        <Accordion type="multiple" defaultValue={Object.keys(groupedIssues)} className="w-full space-y-4">
            
            <AuditIssueSection type="mismatch" title="Income/Expense Mismatches" issues={groupedIssues.mismatch} />
            <AuditIssueSection type="uncategorized" title="Uncategorized Items" issues={groupedIssues.uncategorized} />
            <AuditIssueSection type="missing_hierarchy" title="Missing Category Data" issues={groupedIssues.missing_hierarchy} />

        </Accordion>
      )}

    </div>
  );
}

function AuditIssueSection({ type, title, issues }: { type: string, title: string, issues?: AuditIssue[] }) {
    if (!issues || issues.length === 0) return null;

    return (
        <AccordionItem value={type}>
            <Card className="shadow-md">
                <AccordionTrigger className="p-6 hover:no-underline">
                    <div className="flex items-center gap-3">
                        <AlertCircle className="h-5 w-5 text-destructive" />
                        <h3 className="text-lg font-semibold">{title}</h3>
                        <Badge variant="destructive">{issues.length} Found</Badge>
                    </div>
                </AccordionTrigger>
                <AccordionContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Reason</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {issues.map(issue => (
                                <TableRow key={issue.transaction.id}>
                                    <TableCell>{issue.transaction.date}</TableCell>
                                    <TableCell>{issue.transaction.description}</TableCell>
                                    <TableCell><Badge variant="outline" className="font-normal">{issue.message}</Badge></TableCell>
                                    <TableCell className="text-right font-mono">{formatCurrency(issue.transaction.amount)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </AccordionContent>
            </Card>
        </AccordionItem>
    )
}
