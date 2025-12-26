
'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion } from '@/components/ui/accordion';
import { CheckCircle, ShieldAlert, Edit, Repeat, ArrowRightLeft, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Transaction, AuditIssue } from './types';
import { AuditIssueSection } from './AuditIssueSection';
import { BatchEditDialog } from '../../transactions/batch-edit-dialog';
import { isSameDay, subDays, addDays } from 'date-fns';

export function FinancialIntegrityReport({ transactions, onRefresh }: { transactions: Transaction[], onRefresh: () => void }) {

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBatchEditDialogOpen, setBatchEditDialogOpen] = useState(false);

  const issues = useMemo(() => {
    const foundIssues: AuditIssue[] = [];
    const seenTransactions = new Set<string>();

    transactions.forEach((tx, index) => {
      const cats = tx.categoryHierarchy;
      
      // 1. Missing or Incomplete Hierarchy Check
      if (!cats || !cats.l0 || !cats.l2) {
        foundIssues.push({ type: 'missing_hierarchy', message: 'Category hierarchy is missing or incomplete.', transaction: tx });
      }

      // 2. Income/Expense Sign Mismatch Check
      const isIncomeL0 = cats?.l0?.toLowerCase().includes('income');
      const isExpenseL0 = cats?.l0?.toLowerCase().includes('expense');
      if ((isIncomeL0 && tx.amount < 0) || (isExpenseL0 && tx.amount > 0)) {
        foundIssues.push({ type: 'mismatch', message: `Amount is ${tx.amount < 0 ? 'negative' : 'positive'} but category is ${cats.l0}.`, transaction: tx });
      }

      // 3. Uncategorized Check
      const isUncategorized = cats?.l2?.toLowerCase().includes('uncategorized') || cats?.l2?.toLowerCase().includes('needs review');
      if (isUncategorized) {
        foundIssues.push({ type: 'uncategorized', message: `Marked as '${cats.l2}'.`, transaction: tx });
      }
      
      // 4. Duplicate Check
      const uniqueTxString = `${tx.date}|${tx.description}|${tx.amount.toFixed(2)}`;
      if (seenTransactions.has(uniqueTxString)) {
        foundIssues.push({ type: 'duplicate', message: 'Exact duplicate found.', transaction: tx });
      }
      seenTransactions.add(uniqueTxString);

      // 5. Transfer Miscategorization Check
      const descLower = tx.description.toLowerCase();
      const transferKeywords = ['transfer', 'zelle', 'venmo', 'payment to', 'payment from'];
      if (transferKeywords.some(k => descLower.includes(k)) && (isIncomeL0 || isExpenseL0)) {
        foundIssues.push({ type: 'transfer_error', message: 'Likely a transfer, but categorized as Income/Expense.', transaction: tx });
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
  
  const handleSelectionChange = (id: string, checked: boolean) => {
    setSelectedIds(prev => {
        const newSet = new Set(prev);
        if (checked) {
            newSet.add(id);
        } else {
            newSet.delete(id);
        }
        return Array.from(newSet);
    });
  };

  const selectedTransactions = useMemo(() => {
    return transactions.filter(tx => selectedIds.includes(tx.id));
  }, [transactions, selectedIds]);

  const handleBatchEditSuccess = () => {
    onRefresh();
    setSelectedIds([]);
  }

  return (
    <>
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

       {selectedIds.length > 0 && (
            <div className="flex items-center gap-4 p-3 bg-blue-50 border border-blue-200 rounded-lg animate-in fade-in-50">
                <div className="flex-grow">
                    <span className="font-semibold text-blue-800">{selectedIds.length}</span> items selected.
                </div>
                 <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBatchEditDialogOpen(true)}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Batch Edit
                </Button>
            </div>
        )}
      
      {issues.length === 0 ? (
        <Card className="text-center py-20 bg-green-50/50 border-green-200">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <CardTitle className="text-xl text-green-800">No Issues Found!</CardTitle>
            <CardDescription className="text-green-700">Your transaction data appears to be consistent.</CardDescription>
        </Card>
      ) : (
        <Accordion type="multiple" defaultValue={Object.keys(groupedIssues)} className="w-full space-y-4">
            <AuditIssueSection 
                type="duplicate" 
                icon={Repeat}
                title="Duplicate Transactions" 
                issues={groupedIssues.duplicate} 
                selectedIds={selectedIds}
                onSelectionChange={handleSelectionChange}
            />
            <AuditIssueSection 
                type="transfer_error" 
                icon={ArrowRightLeft}
                title="Transfer Categorization Errors" 
                issues={groupedIssues.transfer_error} 
                selectedIds={selectedIds}
                onSelectionChange={handleSelectionChange}
            />
            <AuditIssueSection 
                type="mismatch" 
                icon={AlertTriangle}
                title="Income/Expense Mismatches" 
                issues={groupedIssues.mismatch} 
                selectedIds={selectedIds}
                onSelectionChange={handleSelectionChange}
            />
            <AuditIssueSection 
                type="uncategorized" 
                icon={AlertTriangle}
                title="Uncategorized Items" 
                issues={groupedIssues.uncategorized}
                selectedIds={selectedIds}
                onSelectionChange={handleSelectionChange}
            />
            <AuditIssueSection 
                type="missing_hierarchy" 
                icon={AlertTriangle}
                title="Missing Category Data" 
                issues={groupedIssues.missing_hierarchy}
                selectedIds={selectedIds}
                onSelectionChange={handleSelectionChange}
            />
        </Accordion>
      )}
    </div>
    
    {isBatchEditDialogOpen && (
        <BatchEditDialog
          isOpen={isBatchEditDialogOpen}
          onOpenChange={setBatchEditDialogOpen}
          transactions={selectedTransactions}
          dataSource={{ id: '', accountName: '' }} // Not needed for this context, but prop is required
          onSuccess={handleBatchEditSuccess}
        />
    )}
    </>
  );
}
