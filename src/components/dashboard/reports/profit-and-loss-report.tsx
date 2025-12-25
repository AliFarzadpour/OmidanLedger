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
    from: '2025-01-01', // Setting a wide range for your 2025 data
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
    
    console.log(`Report Engine: Processing ${transactions.length} transactions...`);

    const incMap = new Map();
    const expMap = new Map();
    let totalInc = 0;
    let totalExp = 0;

    transactions.forEach((tx: any) => {
      // 1. Extract and normalize all labels
      const h = tx.categoryHierarchy || {};
      const l0 = (h.l0 || tx.primaryCategory || "").toLowerCase();
      const l2 = h.l2 || tx.subcategory || "Other";
      
      // 2. Use absolute value for math, but keep sign awareness
      const amount = Number(tx.amount) || 0;

      // 3. Match based on your actual DB strings: "Operating Expenses" and "Income"
      if (l0.includes('income') || l0.includes('revenue')) {
        const val = Math.abs(amount);
        totalInc += val;
        incMap.set(l2, (incMap.get(l2) || 0) + val);
      } else if (l0.includes('expense')) {
        const val = Math.abs(amount);
        totalExp += val;
        expMap.set(l2, (expMap.get(l2) || 0) + val);
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

  if (error) return (
    <Alert variant="destructive" className="m-8">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Firestore Error</AlertTitle>
      <AlertDescription>
        Ensure you have the Composite Index (userId: ASC, date: ASC) and the {`{path=**}`} Security Rule enabled.
        <code className="block mt-2 text-xs">{error.message}</code>
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
        <Button onClick={() => setActiveRange({...dates})} disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
          Run Report
        </Button>
      </div>

      <Card className="shadow-lg border-t-4 border-t-primary">
        <CardHeader className="border-b bg-slate-50/50 text-center">
          <CardTitle className="text-3xl">Profit & Loss Statement</CardTitle>
          <CardDescription className="font-mono">FiscalFlow Reporting Engine</CardDescription>
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
              <TableRow className="bg-green-50 font-bold"><TableCell>Total Income</TableCell><TableCell className="text-right">{formatCurrency(reportData.totalInc)}</TableCell></TableRow>
              {reportData.income.map(i => <TableRow key={i.name}><TableCell className="pl-8">{i.name}</TableCell><TableCell className="text-right">{formatCurrency(i.total)}</TableCell></TableRow>)}
              
              <TableRow className="h-4"><TableCell colSpan={2}/></TableRow>

              <TableRow className="bg-red-50 font-bold"><TableCell>Total Expenses</TableCell><TableCell className="text-right">({formatCurrency(reportData.totalExp)})</TableCell></TableRow>
              {reportData.expenses.map(e => <TableRow key={e.name}><TableCell className="pl-8">{e.name}</TableCell><TableCell className="text-right">{formatCurrency(e.total)}</TableCell></TableRow>)}
              
              <TableRow className="border-t-4 font-black text-xl">
                <TableCell>Net Income</TableCell>
                <TableCell className="text-right">{formatCurrency(reportData.net)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
