
'use client';

import { useState, useMemo, useEffect } from 'react';
import { DateRange } from 'react-day-picker';
import { format, startOfMonth } from 'date-fns';
import { collectionGroup, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { useFirestore, useUser, useCollection } from '@/firebase';
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

  const transactionsQuery = useMemo(() => {
    if (!user || !firestore || !activeDateRange?.from || !activeDateRange?.to) return null;
    
    const startTimestamp = Timestamp.fromDate(activeDateRange.from);
    const endTimestamp = Timestamp.fromDate(activeDateRange.to);

    return query(
      collectionGroup(firestore, 'transactions'),
      where('userId', '==', user.uid),
      where('reviewStatus', '==', 'approved'), // Only include approved transactions
      where('date', '>=', startTimestamp),
      where('date', '<=', endTimestamp),
      orderBy('date', 'desc')
    );
  }, [user, firestore, activeDateRange]);

  const { data: transactions, isLoading, error } = useCollection<Transaction>(transactionsQuery);

  const handleRunReport = () => {
    setActiveDateRange(pendingDateRange);
  };

  const { income, expenses, netIncome } = useMemo(() => {
    if (!transactions) return { income: [], expenses: [], netIncome: 0 };

    const incomeMap = new Map<string, number>();
    const expenseMap = new Map<string, number>();
    let totalIncome = 0;
    let totalExpenses = 0;

    transactions.forEach((txn) => {
      const hierarchy = txn.categoryHierarchy; 
      if (!hierarchy || !hierarchy.l0 || !hierarchy.l2) return;

      const l0 = hierarchy.l0.toLowerCase();
      const l2 = hierarchy.l2;

      if (l0 === 'income') {
        totalIncome += txn.amount;
        incomeMap.set(l2, (incomeMap.get(l2) || 0) + txn.amount);
      } else if (l0 === 'expense' || l0 === 'expenses') {
        totalExpenses += txn.amount;
        expenseMap.set(l2, (expenseMap.get(l2) || 0) + txn.amount);
      }
    });

    const toArray = (map: Map<string, number>) => 
      Array.from(map, ([name, total]) => ({ name, total }));

    return {
      income: toArray(incomeMap),
      expenses: toArray(expenseMap),
      netIncome: totalIncome + totalExpenses,
    };
  }, [transactions]);

  const totalIncome = income.reduce((acc, item) => acc + item.total, 0);
  const totalExpenses = expenses.reduce((acc, item) => acc + item.total, 0);

  const handleDateInputChange = (field: 'from' | 'to', value: string) => {
    const date = value ? new Date(value) : undefined;
    if (date && !isNaN(date.getTime())) {
      setPendingDateRange(prev => ({ ...prev, [field]: date }));
    }
  };

  const renderContent = () => {
    if (!mounted) {
      return <Skeleton className="h-64 w-full" />;
    }
    if (isLoading) {
      return <Skeleton className="h-64 w-full" />;
    }
    if (error) {
      return (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Data</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
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
    if (!transactions || transactions.length === 0) {
      return (
        <p className="py-8 text-center text-muted-foreground">
          No approved transaction data available for the selected period.
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
                 <p className="text-xs text-muted-foreground">This report is generated based on approved transactions only. Items marked for review are not included.</p>
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
