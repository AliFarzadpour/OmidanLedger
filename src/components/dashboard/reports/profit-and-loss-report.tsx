'use client';

import { useState, useMemo, useEffect } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { collectionGroup, query, where, orderBy } from 'firebase/firestore';
import { useFirestore, useUser, useCollection } from '@/firebase';
import { formatCurrency } from '@/lib/format';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlayCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function ProfitAndLossReport() {
  const { user } = useUser();
  const firestore = useFirestore();

  const [dates, setDates] = useState({
    from: '2025-01-01', 
    to: '2025-12-31'
  });
  
  const [activeRange, setActiveRange] = useState(dates);

  const transactionsQuery = useMemo(() => {
    if (!user || !firestore) return null;
    return query(
      collectionGroup(firestore, 'transactions'),
      where('userId', '==', user.uid),
      where('date', '>=', activeRange.from),
      where('date', '<=', activeRange.to),
      orderBy('date', 'asc')
    );
  }, [user, firestore, activeRange]);

  const { data: transactions, isLoading, error } = useCollection(transactionsQuery);

  const reportData = useMemo(() => {
    if (!transactions) return { income: [], expenses: [], totalInc: 0, totalExp: 0, net: 0 };
    
    console.log(`Report Engine: Processing ${transactions.length} total rows found.`);

    const incMap = new Map();
    const expMap = new Map();
    let totalInc = 0;
    let totalExp = 0;

    transactions.forEach((tx: any) => {
      // 1. Combine all category fields into one string to prevent missing plural/singular matches
      const h = tx.categoryHierarchy || {};
      const categoryPath = `${h.l0 || ''} ${h.l1 || ''} ${tx.primaryCategory || ''}`.toLowerCase();
      
      const label = h.l2 || tx.subcategory || "Other / Uncategorized";
      const amount = Math.abs(Number(tx.amount) || 0);

      // 2. Broad keyword matching
      if (categoryPath.includes('income') || categoryPath.includes('revenue')) {
        totalInc += amount;
        incMap.set(label, (incMap.get(label) || 0) + amount);
      } else if (categoryPath.includes('expense')) {
        totalExp += amount;
        expMap.set(label, (expMap.get(label) || 0) + amount);
      } else {
        console.warn(`Row Skipped - No 'income' or 'expense' keyword in path: "${categoryPath}" for ${tx.description}`);
      }
    });

    return {
      income: Array.from(incMap, ([name, total]) => ({ name, total })),
      expenses: Array.from(expMap, ([name, total]) => ({ name, total })),
      totalInc,
      totalExp,
      net: totalInc - totalExp 
    };
  }, [transactions]);

  return (
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
          Run Fiscal Report
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
          <Table>
            <TableBody>
              {/* INCOME SECTION */}
              <TableRow className="bg-green-50 font-bold border-b-2 border-green-200">
                <TableCell className="text-green-800 text-lg">TOTAL INCOME</TableCell>
                <TableCell className="text-right text-green-800 text-lg">{formatCurrency(reportData.totalInc)}</TableCell>
              </TableRow>
              {reportData.income.length > 0 ? reportData.income.map(i => (
                <TableRow key={i.name} className="border-none">
                  <TableCell className="pl-12 text-muted-foreground">{i.name}</TableCell>
                  <TableCell className="text-right">{formatCurrency(i.total)}</TableCell>
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
                <TableRow key={e.name} className="border-none">
                  <TableCell className="pl-12 text-muted-foreground">{e.name}</TableCell>
                  <TableCell className="text-right">{formatCurrency(e.total)}</TableCell>
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
        </CardContent>
      </Card>
    </div>
  );
}
