
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
    from: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    to: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });
  
  const [activeRange, setActiveRange] = useState(dates);

  const handleRunReport = () => {
    setActiveRange({ ...dates });
  };

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
    
    console.log(`Report Engine: Processing ${transactions.length} rows...`);

    const incMap = new Map();
    const expMap = new Map();
    let totalInc = 0;
    let totalExp = 0;

    transactions.forEach((tx: any) => {
      // 1. Collect EVERY possible category label into one string
      const h = tx.categoryHierarchy || {};
      const allLabels = [
        h.l0, h.l1, h.l2, h.l3, 
        tx.primaryCategory, 
        tx.subcategory
      ].filter(Boolean).join(' ').toLowerCase();
      
      const label = h.l2 || tx.subcategory || 'General / Uncategorized';
      const amount = Number(tx.amount) || 0;

      // 2. Check for keywords anywhere in those labels
      if (allLabels.includes('income') || allLabels.includes('revenue')) {
        totalInc += amount;
        incMap.set(label, (incMap.get(label) || 0) + amount);
      } else if (allLabels.includes('expense')) {
        totalExp += amount;
        expMap.set(label, (expMap.get(label) || 0) + amount);
      } else {
        // This log will tell you EXACTLY why a transaction is being ignored
        console.warn(`Row Ignored: "${tx.description}". Labels found: [${allLabels}]`);
      }
    });

    return {
      income: Array.from(incMap, ([name, total]) => ({ name, total })),
      expenses: Array.from(expMap, ([name, total]) => ({ name, total })),
      totalInc,
      totalExp,
      net: totalInc + totalExp 
    };
  }, [transactions]);

  // Display error if Firestore blocks the request
  if (error) return (
    <Alert variant="destructive" className="m-8">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Firestore Error</AlertTitle>
      <AlertDescription>
        Ensure you have the {`{path=**}`} wildcard in your security rules.
        <code className="block mt-2 text-xs font-mono">{error.message}</code>
      </AlertDescription>
    </Alert>
  );

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
        <Button onClick={handleRunReport} disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
          Run Fiscal Report
        </Button>
      </div>

      <Card className="shadow-lg border-t-4 border-t-primary">
        <CardHeader className="border-b bg-slate-50/50 text-center">
          <CardTitle className="text-3xl">Profit & Loss Statement</CardTitle>
          <CardDescription className="font-mono">
             {activeRange.from} — {activeRange.to}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {isLoading ? (
             <div className="flex flex-col items-center justify-center p-12 space-y-4">
               <Loader2 className="h-8 w-8 animate-spin text-primary" />
               <p className="text-sm text-muted-foreground italic">Fetching ledger data...</p>
             </div>
          ) : (
            <Table>
              <TableBody>
                {/* INCOME SECTION */}
                <TableRow className="bg-green-50/50 font-bold">
                  <TableCell className="text-lg text-green-700">Total Income</TableCell>
                  <TableCell className="text-right text-lg">{formatCurrency(reportData.totalInc)}</TableCell>
                </TableRow>
                {reportData.income.length > 0 ? reportData.income.map(item => (
                  <TableRow key={item.name} className="border-none">
                    <TableCell className="pl-12 text-muted-foreground">{item.name}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.total)}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-4">No income found.</TableCell></TableRow>
                )}

                <TableRow className="h-8"><TableCell colSpan={2} /></TableRow>

                {/* EXPENSE SECTION */}
                <TableRow className="bg-red-50/50 font-bold">
                  <TableCell className="text-lg text-red-700">Total Expenses</TableCell>
                  <TableCell className="text-right text-lg">{formatCurrency(reportData.totalExp)}</TableCell>
                </TableRow>
                {reportData.expenses.length > 0 ? reportData.expenses.map(item => (
                  <TableRow key={item.name} className="border-none">
                    <TableCell className="pl-12 text-muted-foreground">{item.name}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.total)}</TableCell>
                  </TableRow>
                )) : (
                   <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-4">No expenses found.</TableCell></TableRow>
                )}

                {/* NET INCOME */}
                <TableRow className="border-t-4 border-double font-black text-2xl">
                  <TableCell>Net Operating Income</TableCell>
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
  );
}
