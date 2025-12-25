'use client';

import { useState, useMemo, useEffect } from 'react';
import { DateRange } from 'react-day-picker';
import { format, startOfMonth } from 'date-fns';
import { collectionGroup, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { formatCurrency } from '@/lib/format';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlayCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

type Transaction = {
  id: string;
  date: string | Timestamp; // Can be string or Timestamp
  description: string;
  amount: number;
  primaryCategory: string; // Keep for fallback
  subcategory: string; // Keep for fallback
  categoryHierarchy?: {
    l0: string;
    l1: string;
    l2: string;
    l3: string;
  };
  reviewStatus?: 'approved' | 'needs-review' | 'incorrect';
};

type ReportSection = {
  title: string;
  total: number;
  items: { name: string; total: number }[];
};

export function ProfitAndLossReport() {
  const { user } = useUser();
  const firestore = useFirestore();

  const [pendingDateRange, setPendingDateRange] = useState<DateRange | undefined>();
  
  const [activeDateRange, setActiveDateRange] = useState<DateRange | undefined>();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!mounted) {
      const initialRange = {
        from: startOfMonth(new Date()),
        to: new Date(),
      };
      setPendingDateRange(initialRange);
      setActiveDateRange(initialRange);
      setMounted(true);
    }
  }, [mounted]);

  // --- REFACTORED DATA FETCHING ---
  const incomeQuery = useMemoFirebase(() => {
    if (!user || !firestore || !activeDateRange?.from || !activeDateRange?.to) return null;
    const startDate = format(activeDateRange.from, 'yyyy-MM-dd');
    const endDate = format(activeDateRange.to, 'yyyy-MM-dd');
    return query(
      collectionGroup(firestore, 'transactions'),
      where('userId', '==', user.uid),
      where('categoryHierarchy.l0', '==', 'Income'),
      where('date', '>=', startDate),
      where('date', '<=', endDate),
      orderBy('date', 'asc')
    );
  }, [user, firestore, activeDateRange]);

  const expenseQuery = useMemoFirebase(() => {
    if (!user || !firestore || !activeDateRange?.from || !activeDateRange?.to) return null;
    const startDate = format(activeDateRange.from, 'yyyy-MM-dd');
    const endDate = format(activeDateRange.to, 'yyyy-MM-dd');
    return query(
      collectionGroup(firestore, 'transactions'),
      where('userId', '==', user.uid),
      where('categoryHierarchy.l0', 'in', ['Expense', 'Expenses']),
      where('date', '>=', startDate),
      where('date', '<=', endDate),
      orderBy('date', 'asc')
    );
  }, [user, firestore, activeDateRange]);

  const { data: incomeTransactions, isLoading: isLoadingIncome, error: incomeError } = useCollection<Transaction>(incomeQuery);
  const { data: expenseTransactions, isLoading: isLoadingExpenses, error: expenseError } = useCollection<Transaction>(expenseQuery);
  // --- END REFACTORED DATA FETCHING ---

  const handleRunReport = () => {
    if (pendingDateRange) {
        setActiveDateRange({ ...pendingDateRange });
    }
  };

  const { income, expenses, netIncome } = useMemo(() => {
    const processTransactions = (transactions: Transaction[] | null) => {
        if (!transactions) return [];
        const map = new Map<string, number>();
        transactions.forEach((txn) => {
          const l2 = txn.categoryHierarchy?.l2 || txn.subcategory || "Uncategorized";
          map.set(l2, (map.get(l2) || 0) + txn.amount);
        });
        return Array.from(map, ([name, total]) => ({ name, total }));
    };
  
    const incomeItems = processTransactions(incomeTransactions);
    const expenseItems = processTransactions(expenseTransactions);
    
    const totalIncome = incomeItems.reduce((acc, item) => acc + item.total, 0);
    const totalExpenses = expenseItems.reduce((acc, item) => acc + item.total, 0);

    return {
      income: incomeItems,
      expenses: expenseItems,
      netIncome: totalIncome + totalExpenses,
    };
  }, [incomeTransactions, expenseTransactions]);

  const totalIncome = income.reduce((acc, item) => acc + item.total, 0);
  const totalExpenses = expenses.reduce((acc, item) => acc + item.total, 0);
  const isLoading = isLoadingIncome || isLoadingExpenses;
  const error = incomeError || expenseError;

  const handleDateInputChange = (field: 'from' | 'to', value: string) => {
    const date = value ? new Date(value) : undefined;
    if (date && !isNaN(date.getTime())) {
      // Adjust for timezone offset by creating date in UTC
      const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      setPendingDateRange(prev => ({ ...prev, [field]: localDate }));
    }
  };

  const renderContent = () => {
    if (!mounted || isLoading) {
      return <Skeleton className="h-64 w-full" />;
    }
    if (error) {
      return (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Data</AlertTitle>
          <AlertDescription>
            <p>An error occurred while fetching your financial data. This is often due to a missing Firestore index.</p>
            <pre className="font-mono text-xs mt-2 bg-slate-100 p-2 rounded whitespace-pre-wrap">{error.message}</pre>
          </AlertDescription>
        </Alert>
      );
    }
    if (!activeDateRange) {
         return (
            <p className="py-8 text-center text-muted-foreground">
                Please select a date range and click "Run Report" to generate your Profit &amp; Loss statement.
            </p>
        );
    }
    if (!incomeTransactions?.length && !expenseTransactions?.length) {
      return (
        <p className="py-8 text-center text-muted-foreground">
          No transaction data available for the selected period.
        </p>
      );
    }

    return (
      <Table>
        <TableBody>
          <ReportSection title="Income" items={income} total={totalIncome} isBold />
          <ReportSection title="Expenses" items={expenses} total={totalExpenses} isBold />
          <TableRow className="font-bold text-lg bg-card border-t-2">
            <TableCell>Net Income</TableCell>
            <TableCell className="text-right">{formatCurrency(netIncome)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
  };
  
  const companyName = user?.displayName ? `${user.displayName}'s Company` : "FiscalFlow LLC";

  return (
    <div className="space-y-6 p-4 md:p-8">
       <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Profit &amp; Loss Statement</h1>
                <p className="text-muted-foreground">Review your income, expenses, and profitability.</p>
            </div>
            {mounted && (
              <div className="flex items-end gap-2">
                <div className="grid gap-2">
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={pendingDateRange?.from ? format(pendingDateRange.from, 'yyyy-MM-dd') : ''}
                    onChange={(e) => handleDateInputChange('from', e.target.value)}
                    className="w-[180px]"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="end-date">End Date</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={pendingDateRange?.to ? format(pendingDateRange.to, 'yyyy-MM-dd') : ''}
                    onChange={(e) => handleDateInputChange('to', e.target.value)}
                    className="w-[180px]"
                  />
                </div>
                <Button onClick={handleRunReport} disabled={isLoading}>
                    <PlayCircle className="mr-2 h-4 w-4" />
                    {isLoading ? 'Loading...' : 'Run Report'}
                </Button>
              </div>
            )}
       </div>

        <Card>
            <CardHeader className="text-center">
                <CardTitle className="text-2xl">{companyName}</CardTitle>
                <CardDescription>
                    {activeDateRange ? (
                         <>For the period from {activeDateRange.from ? format(activeDateRange.from, 'MMMM d, yyyy') : '...'} to {activeDateRange.to ? format(activeDateRange.to, 'MMMM d, yyyy') : '...'}</>
                    ) : 'No period selected'}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {renderContent()}
            </CardContent>
            <CardFooter>
                 <p className="text-xs text-muted-foreground">This report includes all transactions within the period, regardless of review status.</p>
            </CardFooter>
        </Card>
    </div>
  );
}

function ReportSection({ title, items, total, isBold = false }: { title: string; items: { name: string; total: number }[], total: number, isBold?: boolean }) {
  if (items.length === 0) return null;
  return (
    <>
      <TableRow className={cn(isBold && "font-bold", "bg-muted/30")}>
        <TableCell>{title}</TableCell>
        <TableCell className="text-right">{formatCurrency(total)}</TableCell>
      </TableRow>
      {items.map((item) => (
        <TableRow key={item.name}>
          <TableCell className="pl-8 text-muted-foreground">{item.name}</TableCell>
          <TableCell className="text-right">{formatCurrency(item.total)}</TableCell>
        </TableRow>
      ))}
    </>
  );
}
