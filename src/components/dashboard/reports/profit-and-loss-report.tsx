'use client';

import { useState, useMemo, useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, getDocs, query, collectionGroup, where, writeBatch, doc } from 'firebase/firestore';
import { parseISO, isWithinInterval } from 'date-fns';
import { formatCurrency } from '@/lib/format';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlayCircle, AlertCircle, Loader2, ChevronsRight } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ProfitAndLossDrawer } from './profit-and-loss-drawer';
import type { Transaction } from '@/components/dashboard/transactions-table';

// Helper: normalize Firestore Timestamp OR string to JS Date (or null)
function toDate(value: any): Date | null {
  if (!value) return null;

  // Firestore Timestamp
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    return value.toDate();
  }

  // ISO date string
  if (typeof value === 'string') {
    const d = parseISO(value);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

export function ProfitAndLossReport() {
  const { user } = useUser();
  const firestore = useFirestore();

  const [dates, setDates] = useState({ from: '', to: '' });
  const [activeRange, setActiveRange] = useState({ from: '', to: '' });
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for the drawer
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<{ name: string; transactions: Transaction[] } | null>(null);

  useEffect(() => {
    const initialDates = {
      from: '2025-01-01',
      to: '2025-12-31'
    };
    setDates(initialDates);
    setActiveRange(initialDates);
  }, []);

  useEffect(() => {
    if (!user || !firestore) return;
    setIsLoading(true);
    
    const fetchAllData = async () => {
        try {
            const accountsSnap = await getDocs(query(collection(firestore, `users/${user.uid}/bankAccounts`)));
            if (accountsSnap.empty) {
                setAllTransactions([]);
                setIsLoading(false);
                return;
            }

            const transactionPromises = accountsSnap.docs.map(accountDoc => 
                getDocs(collection(accountDoc.ref, 'transactions'))
            );

            const transactionSnapshots = await Promise.all(transactionPromises);
            const fetchedTransactions = transactionSnapshots.flatMap(snap => 
                snap.docs.map(d => ({...d.data(), id: d.id, bankAccountId: d.ref.parent.parent?.id }))
            );
            
            setAllTransactions(fetchedTransactions);

        } catch (e: any) {
            console.error(e);
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    };
    fetchAllData();
  }, [user, firestore]);

  const reportData = useMemo(() => {
    const empty = { income: [], expenses: [], totalInc: 0, totalExp: 0, net: 0, rows: 0, filteredRows: 0 };
    if (!allTransactions || !activeRange.from || !activeRange.to) return empty;
  
    const fromD = parseISO(activeRange.from);
    const toD = parseISO(activeRange.to);
  
    const incMap = new Map<string, { total: number; transactions: Transaction[] }>();
    const expMap = new Map<string, { total: number; transactions: Transaction[] }>();
    let totalInc = 0;
    let totalExp = 0;
  
    let filteredRows = 0;
  
    const userTransactions = allTransactions.filter(tx => tx.userId === user?.uid);

    for (const tx of userTransactions) {
      const d = toDate(tx.date);
      if (!d) continue;
  
      const inRange = isWithinInterval(d, { start: fromD, end: toD });
      if (!inRange) continue;
      filteredRows++;
  
      const rawAmount = Number(tx.amount) || 0;
      const isIncome = rawAmount > 0;
      const isExpense = rawAmount < 0;
  
      const h = tx.categoryHierarchy || {};
      const label = h.l2 || tx.subcategory || tx.secondaryCategory || tx.primaryCategory || 'Other / Uncategorized';
      const normalizedLabel = label.trim().replace(/^Line \d+: /, '');

      const amountAbs = Math.abs(rawAmount);
  
      if (isIncome) {
        totalInc += amountAbs;
        const current = incMap.get(normalizedLabel) || { total: 0, transactions: [] };
        current.total += amountAbs;
        current.transactions.push(tx);
        incMap.set(normalizedLabel, current);
      } else if (isExpense) {
        totalExp += amountAbs;
        const current = expMap.get(normalizedLabel) || { total: 0, transactions: [] };
        current.total += amountAbs;
        current.transactions.push(tx);
        expMap.set(normalizedLabel, current);
      }
    }
  
    const income = Array.from(incMap, ([name, data]) => ({ name, ...data })).sort((a, b) => b.total - a.total);
    const expenses = Array.from(expMap, ([name, data]) => ({ name, ...data })).sort((a, b) => b.total - a.total);
  
    return {
      income,
      expenses,
      totalInc,
      totalExp,
      net: totalInc - totalExp,
      rows: userTransactions.length,
      filteredRows,
    };
  }, [allTransactions, user, activeRange]);

  const handleRowClick = (name: string, transactions: Transaction[]) => {
    setSelectedCategory({ name, transactions });
    setIsDrawerOpen(true);
  };
  

  if (error) {
    return (
        <Alert variant="destructive" className="m-8">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Firestore Error</AlertTitle>
            <AlertDescription>
                <code className="mt-2 block text-xs font-mono">{error}</code>
            </AlertDescription>
        </Alert>
    );
  }

  return (
    <>
    <div className="p-8 space-y-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-end bg-muted/50 p-6 rounded-xl border">
        <div className="flex gap-4">
          <div className="grid gap-2">
            <Label>Start Date</Label>
            <Input type="date" value={dates.from} onChange={e => setDates(d => ({...d, from: e.target.value}))} />
          </div>
          <div className="grid gap-2">
            <Label>End Date</Label>
            <Input type="date" value={dates.to} onChange={e => setDates(d => ({...d, to: e.target.value}))} />
          </div>
        </div>
        <Button onClick={() => setActiveRange({...dates})} disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
          Run Report
        </Button>
      </div>

      <Card className="shadow-lg border-t-4 border-t-primary">
        <CardHeader className="border-b bg-slate-50/50 text-center">
          <CardTitle className="text-3xl font-bold">Profit & Loss Statement</CardTitle>
          <CardDescription className="font-mono text-sm uppercase tracking-widest">
             {activeRange.from} TO {activeRange.to}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
           <div className="text-xs text-muted-foreground text-center mb-4 font-mono">
             Auth UID: {user?.uid} • Loaded: {reportData.rows} total tx • In range: {reportData.filteredRows} rows
           </div>
          {isLoading ? (
             <div className="flex flex-col items-center justify-center p-12 space-y-4">
               <Loader2 className="h-8 w-8 animate-spin text-primary" />
               <p className="text-sm text-muted-foreground italic">Fetching ledger data...</p>
             </div>
          ) : (
            <Table>
              <TableBody>
                {/* INCOME SECTION */}
                <TableRow className="bg-green-50 font-bold border-b-2 border-green-200">
                  <TableCell className="text-green-800 text-lg">TOTAL INCOME</TableCell>
                  <TableCell className="text-right text-green-800 text-lg">{formatCurrency(reportData.totalInc)}</TableCell>
                </TableRow>
                {reportData.income.length > 0 ? reportData.income.map(i => (
                  <TableRow key={i.name} onClick={() => handleRowClick(i.name, i.transactions)} className="cursor-pointer hover:bg-slate-50">
                    <TableCell className="pl-8 text-muted-foreground group-hover:text-primary">{i.name}</TableCell>
                    <TableCell className="text-right flex justify-end items-center gap-2">{formatCurrency(i.total)} <ChevronsRight className="h-4 w-4 text-slate-300"/></TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={2} className="text-center py-4 text-xs italic text-muted-foreground">No income transactions found.</TableCell></TableRow>
                )}
                
                <TableRow className="h-8"><TableCell colSpan={2}/></TableRow>

                {/* EXPENSE SECTION */}
                <TableRow className="bg-red-50 font-bold border-b-2 border-red-200">
                  <TableCell className="text-red-800 text-lg">TOTAL EXPENSES</TableCell>
                  <TableCell className="text-right text-red-800 text-lg">({formatCurrency(reportData.totalExp)})</TableCell>
                </TableRow>
                {reportData.expenses.length > 0 ? reportData.expenses.map(e => (
                  <TableRow key={e.name} onClick={() => handleRowClick(e.name, e.transactions)} className="cursor-pointer hover:bg-slate-50">
                    <TableCell className="pl-8 text-muted-foreground">{e.name}</TableCell>
                     <TableCell className="text-right flex justify-end items-center gap-2">{formatCurrency(e.total)} <ChevronsRight className="h-4 w-4 text-slate-300"/></TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={2} className="text-center py-4 text-xs italic text-muted-foreground">No expense transactions found.</TableCell></TableRow>
                )}
                
                <TableRow className="border-t-4 border-double font-black text-2xl bg-slate-50">
                  <TableCell>NET OPERATING INCOME</TableCell>
                  <TableCell className={`text-right ${reportData.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(reportData.net)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
    {selectedCategory && (
      <ProfitAndLossDrawer 
        isOpen={isDrawerOpen} 
        onOpenChange={setIsDrawerOpen}
        category={selectedCategory}
      />
    )}
    </>
  );
}
