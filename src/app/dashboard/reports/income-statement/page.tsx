
'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { DateRange } from 'react-day-picker';
import { format, startOfYear, endOfYear } from 'date-fns';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { formatCurrency } from '@/lib/format';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlayCircle, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Transaction = {
  id: string;
  date: string | Timestamp;
  description: string;
  amount: number;
  primaryCategory?: string;
  subcategory?: string;
  categoryHierarchy?: {
    l0: string;
    l1: string;
    l2: string;
    l3: string;
  };
};

export default function IncomeStatementPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  
  const [activeDateRange, setActiveDateRange] = useState({ 
    from: startOfYear(new Date()), 
    to: endOfYear(new Date()) 
  });
  
  const [pendingDateRange, setPendingDateRange] = useState({ 
    from: startOfYear(new Date()), 
    to: endOfYear(new Date()) 
  });

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user || !firestore) return;
    setIsLoading(true);
    setError(null);

    try {
      const accountsSnap = await getDocs(query(collection(firestore, `users/${user.uid}/bankAccounts`)));
      if (accountsSnap.empty) {
        setTransactions([]);
        setIsLoading(false);
        return;
      }

      const transactionPromises = accountsSnap.docs.map(accountDoc => {
        const transactionsRef = collection(firestore, `users/${user.uid}/bankAccounts/${accountDoc.id}/transactions`);
        const q = query(
          transactionsRef,
          where('date', '>=', format(activeDateRange.from, 'yyyy-MM-dd')),
          where('date', '<=', format(activeDateRange.to, 'yyyy-MM-dd'))
        );
        return getDocs(q);
      });
      
      const transactionSnapshots = await Promise.all(transactionPromises);
      
      const allTxs = transactionSnapshots.flatMap(snap => 
        snap.docs.map(d => ({ ...d.data(), id: d.id }))
      ) as Transaction[];
      
      const incomeTxs = allTxs.filter(tx => tx.categoryHierarchy?.l0 === 'Income');
      
      incomeTxs.sort((a, b) => new Date(a.date as string).getTime() - new Date(b.date as string).getTime());
      
      setTransactions(incomeTxs);

    } catch (err: any) {
      console.error("Error fetching income statement data:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user, firestore, activeDateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);


  const { incomeItems, totalIncome } = useMemo(() => {
    if (!transactions) return { incomeItems: [], totalIncome: 0 };
    
    const incomeMap = new Map<string, { total: number; transactions: Transaction[] }>();
    let total = 0;

    transactions.forEach((tx) => {
      // No need to filter by l0 here, it's pre-filtered
      const l2 = tx.categoryHierarchy?.l2 || tx.subcategory || 'Uncategorized Income';
      total += tx.amount;
      
      const current = incomeMap.get(l2) || { total: 0, transactions: [] };
      current.total += tx.amount;
      current.transactions.push(tx);
      incomeMap.set(l2, current);
    });

    const incomeItems = Array.from(incomeMap, ([name, data]) => ({ name, ...data }));
    return { incomeItems, totalIncome: total };
  }, [transactions]);

  const handleDateInputChange = (field: 'from' | 'to', value: string) => {
    const date = value ? new Date(value + 'T00:00:00') : new Date(); // Use local timezone
    setPendingDateRange(prev => ({ ...prev, [field]: date }));
  };

  const handleRunReport = () => {
    setActiveDateRange(pendingDateRange);
  };

  const renderContent = () => {
    if (isLoading) {
      return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }
    if (error) {
      return (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Data</AlertTitle>
          <AlertDescription>
            <p>An error occurred while fetching your income data. This can happen if a required Firestore index is missing.</p>
            <p className="font-mono text-xs mt-2 bg-slate-100 p-2 rounded">{error}</p>
          </AlertDescription>
        </Alert>
      );
    }
    if (!transactions || transactions.length === 0) {
      return (
        <p className="py-8 text-center text-muted-foreground">
          No income transactions found for the selected period.
        </p>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {incomeItems.map((item) => (
            <React.Fragment key={item.name}>
              <TableRow className="bg-muted/30 font-semibold">
                <TableCell>{item.name}</TableCell>
                <TableCell className="text-right">{formatCurrency(item.total)}</TableCell>
              </TableRow>
              {item.transactions.map(tx => (
                <TableRow key={tx.id} className="text-sm">
                  <TableCell className="pl-8 text-muted-foreground">{tx.description}</TableCell>
                  <TableCell className={cn("text-right", tx.amount < 0 ? "text-red-600" : "text-slate-800")}>{formatCurrency(tx.amount)}</TableCell>
                </TableRow>
              ))}
            </React.Fragment>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow className="font-bold text-lg bg-card border-t-2">
            <TableCell>Total Income</TableCell>
            <TableCell className="text-right">{formatCurrency(totalIncome)}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    );
  };

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Income Statement</h1>
          <p className="text-muted-foreground">A detailed breakdown of all your revenue sources.</p>
        </div>
        <div className="flex items-end gap-2">
            <div className="grid gap-2">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={format(pendingDateRange.from, 'yyyy-MM-dd')}
                onChange={(e) => handleDateInputChange('from', e.target.value)}
                className="w-[180px]"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={format(pendingDateRange.to, 'yyyy-MM-dd')}
                onChange={(e) => handleDateInputChange('to', e.target.value)}
                className="w-[180px]"
              />
            </div>
            <Button onClick={handleRunReport} disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlayCircle className="mr-2 h-4 w-4" />}
              Run Report
            </Button>
          </div>
      </div>

      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{user?.displayName || 'Your Company'}</CardTitle>
          <CardDescription>
            {activeDateRange?.from && activeDateRange?.to
              ? `For the period from ${format(activeDateRange.from, 'MMMM d, yyyy')} to ${format(activeDateRange.to, 'MMMM d, yyyy')}`
              : 'No period selected'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {renderContent()}
        </CardContent>
      </Card>
    </div>
  );
}
