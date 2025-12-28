'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion } from '@/components/ui/accordion';
import { CheckCircle, ShieldAlert, Edit, Repeat, ArrowRightLeft, AlertTriangle, Filter, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Transaction, AuditIssue } from './types';
import { AuditIssueSection, type SortConfig } from './AuditIssueSection';
import { useUser, useFirestore } from '@/firebase';
import { doc, writeBatch, getDocs, collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BatchEditDialog } from '@/components/dashboard/transactions/batch-edit-dialog';


export function FinancialIntegrityReport({ transactions, onRefresh }: { transactions: Transaction[], onRefresh: () => void }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<'needs_audit' | 'audited' | 'all'>('needs_audit');
  const [isBatchEditDialogOpen, setBatchEditDialogOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'date', direction: 'desc' });
  const [bankAccountMap, setBankAccountMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    async function fetchBankAccounts() {
      if (!user || !firestore) return;
      const accountsSnap = await getDocs(collection(firestore, `users/${user.uid}/bankAccounts`));
      const map = new Map<string, string>();
      accountsSnap.forEach(doc => {
        map.set(doc.id, doc.data().accountName || 'Unknown Account');
      });
      setBankAccountMap(map);
    }
    fetchBankAccounts();
  }, [user, firestore]);
  
  const issues = useMemo(() => {
    const foundIssues: AuditIssue[] = [];
    const seenTransactions = new Set<string>();

    transactions.forEach((tx) => {
      // Apply filter first
      if (filter !== 'all' && (tx.auditStatus || 'needs_audit') !== filter) {
        return;
      }
      
      const cats = tx.categoryHierarchy;
      const descLower = tx.description.toLowerCase();
      
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

      // 5. Transfer & CC Payment Miscategorization Check
      const paymentKeywords = ['payment - thank you', 'online payment', 'creditcard', 'card payment', 'autopay', 'bill payment'];
      const transferKeywords = ['transfer', 'zelle', 'venmo', ...paymentKeywords];
      
      if (transferKeywords.some(k => descLower.includes(k)) && (isIncomeL0 || isExpenseL0)) {
        foundIssues.push({ type: 'transfer_error', message: 'Likely a transfer/payment, but categorized as Income/Expense.', transaction: tx });
      }

      // Rule 2 Check - CC Payment as Owner's Draw
      const creditCardKeywords = ["CREDITCARD", "CARD", "AUTOPAY", "PAYMENT"];
      if (creditCardKeywords.some(k => descLower.includes(k.toLowerCase())) && cats?.l0 === 'Equity' && cats?.l1 === "Owner's Draw") {
          foundIssues.push({ type: 'credit_card_payment', message: "CC payment misclassified as Owner's Draw", transaction: tx });
      }


    });
    return foundIssues;
  }, [transactions, filter]);
  
  const handleSort = (key: SortConfig['key']) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const groupedAndSortedIssues = useMemo(() => {
    const grouped = issues.reduce((acc, issue) => {
      if (!acc[issue.type]) {
        acc[issue.type] = [];
      }
      acc[issue.type].push(issue);
      return acc;
    }, {} as Record<string, AuditIssue[]>);
    
    // Sort transactions within each group
    for (const type in grouped) {
      grouped[type].sort((a, b) => {
        const aVal = (a.transaction as any)[sortConfig.key];
        const bVal = (b.transaction as any)[sortConfig.key];
        const directionMultiplier = sortConfig.direction === 'asc' ? 1 : -1;
        
        if (sortConfig.key === 'date') {
          return (new Date(aVal).getTime() - new Date(bVal).getTime()) * directionMultiplier;
        }
        if (typeof aVal === 'string') {
          return aVal.localeCompare(bVal) * directionMultiplier;
        }
        if (typeof aVal === 'number') {
          return (aVal - bVal) * directionMultiplier;
        }
        return 0;
      });
    }

    return grouped;
  }, [issues, sortConfig]);
  
  const handleSelectionChange = useCallback((id: string, checked: boolean) => {
    setSelectedIds(prev => {
        const newSet = new Set(prev);
        if (checked) {
            newSet.add(id);
        } else {
            newSet.delete(id);
        }
        return Array.from(newSet);
    });
  }, []);

  const selectedTransactions = useMemo(() => {
    return transactions.filter(tx => selectedIds.includes(tx.id));
  }, [transactions, selectedIds]);

  const handleBatchApprove = async () => {
    if (!user || !firestore || selectedIds.length === 0) return;

    const batch = writeBatch(firestore);
    selectedIds.forEach(txId => {
      // We need to find the full transaction object to get its bankAccountId
      const tx = transactions.find(t => t.id === txId);
      if (tx && tx.bankAccountId) {
        const txRef = doc(firestore, `users/${user.uid}/bankAccounts/${tx.bankAccountId}/transactions`, tx.id);
        batch.update(txRef, { auditStatus: 'audited' });
      }
    });

    try {
      await batch.commit();
      toast({
        title: 'Transactions Audited',
        description: `${selectedIds.length} items have been marked as audited.`
      });
      setSelectedIds([]);
      onRefresh(); // Refetch data to update the view
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to approve transactions.'
      });
    }
  };

  return (
    <>
    <div className="space-y-6">
       <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
            <ShieldAlert className="h-8 w-8 text-primary" />
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Financial Integrity Report</h1>
                <p className="text-muted-foreground">Found {issues.length} potential issues matching your filter.</p>
            </div>
        </div>
         <div className="flex items-center gap-4">
            <Select onValueChange={(val: any) => setFilter(val)} defaultValue="needs_audit">
                <SelectTrigger className="w-[180px]">
                    <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-muted-foreground" />
                        <SelectValue />
                    </div>
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="needs_audit">Needs Audit</SelectItem>
                    <SelectItem value="audited">Audited</SelectItem>
                    <SelectItem value="all">All</SelectItem>
                </SelectContent>
            </Select>
            <Button onClick={onRefresh} variant="outline">
                Re-run Audit
            </Button>
         </div>
      </div>

       {selectedIds.length > 0 && (
            <div className="flex items-center gap-4 p-3 bg-blue-50 border border-blue-200 rounded-lg animate-in fade-in-50">
                <div className="flex-grow">
                    <span className="font-semibold text-blue-800">{selectedIds.length}</span> items selected.
                </div>
                 <Button
                    variant="outline"
                    size="sm"
                    className="bg-white hover:bg-slate-50"
                    onClick={() => setBatchEditDialogOpen(true)}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Batch Edit Category
                </Button>
                 <Button
                    variant="outline"
                    size="sm"
                    className="bg-green-100 text-green-800 border-green-200 hover:bg-green-200"
                    onClick={handleBatchApprove}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Mark as Audited
                </Button>
            </div>
        )}
      
      {issues.length === 0 ? (
        <Card className="text-center py-20 bg-green-50/50 border-green-200">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <CardTitle className="text-xl text-green-800">No Issues Found!</CardTitle>
            <CardDescription className="text-green-700">Your transaction data appears to be consistent based on the current filter.</CardDescription>
        </Card>
      ) : (
        <Accordion type="multiple" defaultValue={Object.keys(groupedAndSortedIssues)} className="w-full space-y-4">
            <AuditIssueSection 
                type="duplicate" 
                icon={Repeat}
                title="Duplicate Transactions" 
                issues={groupedAndSortedIssues.duplicate} 
                selectedIds={selectedIds}
                onSelectionChange={handleSelectionChange}
                sortConfig={sortConfig}
                onSort={handleSort}
                bankAccountMap={bankAccountMap}
            />
            <AuditIssueSection 
                type="transfer_error" 
                icon={ArrowRightLeft}
                title="Transfer & Payment Errors" 
                issues={groupedAndSortedIssues.transfer_error} 
                selectedIds={selectedIds}
                onSelectionChange={handleSelectionChange}
                sortConfig={sortConfig}
                onSort={handleSort}
                bankAccountMap={bankAccountMap}
            />
            <AuditIssueSection 
                type="credit_card_payment" 
                icon={CreditCard}
                title="Credit Card Payment Errors" 
                issues={groupedAndSortedIssues.credit_card_payment} 
                selectedIds={selectedIds}
                onSelectionChange={handleSelectionChange}
                sortConfig={sortConfig}
                onSort={handleSort}
                bankAccountMap={bankAccountMap}
            />
            <AuditIssueSection 
                type="mismatch" 
                icon={AlertTriangle}
                title="Income/Expense Mismatches" 
                issues={groupedAndSortedIssues.mismatch} 
                selectedIds={selectedIds}
                onSelectionChange={handleSelectionChange}
                sortConfig={sortConfig}
                onSort={handleSort}
                bankAccountMap={bankAccountMap}
            />
            <AuditIssueSection 
                type="uncategorized" 
                icon={AlertTriangle}
                title="Uncategorized Items" 
                issues={groupedAndSortedIssues.uncategorized}
                selectedIds={selectedIds}
                onSelectionChange={handleSelectionChange}
                sortConfig={sortConfig}
                onSort={handleSort}
                bankAccountMap={bankAccountMap}
            />
            <AuditIssueSection 
                type="missing_hierarchy" 
                icon={AlertTriangle}
                title="Missing Category Data" 
                issues={groupedAndSortedIssues.missing_hierarchy}
                selectedIds={selectedIds}
                onSelectionChange={handleSelectionChange}
                sortConfig={sortConfig}
                onSort={handleSort}
                bankAccountMap={bankAccountMap}
            />
        </Accordion>
      )}
    </div>
    {isBatchEditDialogOpen && (
        <BatchEditDialog
          isOpen={isBatchEditDialogOpen}
          onOpenChange={setBatchEditDialogOpen}
          transactions={selectedTransactions}
          onSuccess={() => {
            setSelectedIds([]);
            onRefresh();
          }}
        />
      )}
    </>
  );
}
