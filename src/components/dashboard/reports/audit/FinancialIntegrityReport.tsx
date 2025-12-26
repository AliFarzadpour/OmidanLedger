'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion } from '@/components/ui/accordion';
import { CheckCircle, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Transaction, AuditIssue } from './types';
import { AuditIssueSection } from './AuditIssueSection';

export function FinancialIntegrityReport({ transactions, onRefresh }: { transactions: Transaction[], onRefresh: () => void }) {

  const issues = useMemo(() => {
    const foundIssues: AuditIssue[] = [];
    transactions.forEach(tx => {
      const cats = tx.categoryHierarchy;
      
      if (!cats || !cats.l0 || !cats.l2) {
        foundIssues.push({ type: 'missing_hierarchy', message: 'Category hierarchy is missing or incomplete.', transaction: tx });
        return;
      }

      const isIncomeL0 = cats.l0?.toLowerCase().includes('income');
      const isExpenseL0 = cats.l0?.toLowerCase().includes('expense');
      
      if ((isIncomeL0 && tx.amount < 0) || (isExpenseL0 && tx.amount > 0)) {
        foundIssues.push({ type: 'mismatch', message: `Amount is ${tx.amount < 0 ? 'negative' : 'positive'} but category is ${cats.l0}.`, transaction: tx });
      }

      const isUncategorized = cats.l2?.toLowerCase().includes('uncategorized') || cats.l2?.toLowerCase().includes('needs review');
      if (isUncategorized) {
        foundIssues.push({ type: 'uncategorized', message: `Transaction is marked as '${cats.l2}'.`, transaction: tx });
      }
    });
    return foundIssues;
  }, [transactions]);

  const groupedIssues = useMemo(() => {
    return issues.reduce((acc, issue) => {
      if (!acc[issue.type]) {
        acc[issue.type] = [];
      }
      acc[issue.type].push(issue);
      return acc;
    }, {} as Record<string, AuditIssue[]>);
  }, [issues]);

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
            <ShieldAlert className="h-8 w-8 text-primary" />
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Financial Integrity Report</h1>
                <p className="text-muted-foreground">Found {issues.length} potential issues across all accounts.</p>
            </div>
        </div>
        <Button onClick={onRefresh} variant="outline">
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
