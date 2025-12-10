'use client';

import { useState, useMemo } from 'react';
import { DateRange } from 'react-day-picker';
import { addDays, format } from 'date-fns';
import { collectionGroup, query, where, orderBy } from 'firebase/firestore';
import { useFirestore, useUser, useCollection } from '@/firebase';
import { formatCurrency } from '@/lib/format';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

type Transaction = {
  id: string;
  date: string;
  description: string;
  amount: number;
  primaryCategory: string;
};

type ReportSection = {
  title: string;
  total: number;
  items: { name: string; total: number }[];
};

export function ProfitAndLossReport() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(),
  });

  const transactionsQuery = useMemo(() => {
    if (!user || !firestore || !dateRange?.from || !dateRange?.to) return null;
    
    // Ensure the dates are in 'YYYY-MM-DD' string format for Firestore query
    const startDate = format(dateRange.from, 'yyyy-MM-dd');
    const endDate = format(dateRange.to, 'yyyy-MM-dd');

    return query(
      collectionGroup(firestore, 'transactions'),
      where('userId', '==', user.uid),
      where('date', '>=', startDate),
      where('date', '<=', endDate),
      orderBy('date', 'desc')
    );
  }, [user, firestore, dateRange]);

  const { data: transactions, isLoading, error } = useCollection<Transaction>(transactionsQuery);

  const { income, cogs, expenses, netIncome, grossProfit } = useMemo(() => {
    if (!transactions) {
      return { income: [], cogs: [], expenses: [], netIncome: 0, grossProfit: 0 };
    }

    const incomeMap = new Map<string, number>();
    const cogsMap = new Map<string, number>();
    const expenseMap = new Map<string, number>();

    let totalIncome = 0;
    let totalCogs = 0;
    let totalExpenses = 0;

    transactions.forEach((txn) => {
      switch (txn.primaryCategory) {
        case 'Income (Revenue)':
          totalIncome += txn.amount;
          incomeMap.set(txn.primaryCategory, (incomeMap.get(txn.primaryCategory) || 0) + txn.amount);
          break;
        case 'Cost of Goods Sold (COGS)':
          // COGS amounts are typically negative, so we sum them up.
          totalCogs += txn.amount;
          cogsMap.set(txn.primaryCategory, (cogsMap.get(txn.primaryCategory) || 0) + txn.amount);
          break;
        case 'Operating Expenses':
        case 'Other Expenses':
           // Expenses are also negative
          totalExpenses += txn.amount;
          expenseMap.set(txn.primaryCategory, (expenseMap.get(txn.primaryCategory) || 0) + txn.amount);
          break;
        default:
          break;
      }
    });

    const grossProfit = totalIncome + totalCogs; // COGS is negative, so it's effectively subtraction
    const netIncome = grossProfit + totalExpenses; // Expenses are negative

    const toArray = (map: Map<string, number>) => Array.from(map, ([name, total]) => ({ name, total }));

    return {
      income: toArray(incomeMap),
      cogs: toArray(cogsMap),
      expenses: toArray(expenseMap),
      grossProfit,
      netIncome,
    };
  }, [transactions]);

  const totalIncome = income.reduce((acc, item) => acc + item.total, 0);
  const totalCogs = cogs.reduce((acc, item) => acc + item.total, 0);
  const totalExpenses = expenses.reduce((acc, item) => acc + item.total, 0);

  const renderContent = () => {
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
    if (!transactions || transactions.length === 0) {
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
          <ReportSection title="Cost of Goods Sold" items={cogs} total={totalCogs} />
          <TableRow className="font-bold bg-muted/50">
            <TableCell>Gross Profit</TableCell>
            <TableCell className="text-right">{formatCurrency(grossProfit)}</TableCell>
          </TableRow>
          <ReportSection title="Operating Expenses" items={expenses} total={totalExpenses} />
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
    <div className="space-y-6">
       <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Profit & Loss Statement</h1>
                <p className="text-muted-foreground">Review your income, expenses, and profitability.</p>
            </div>
             <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant={"outline"}
                  className={cn(
                    "w-[300px] justify-start text-left font-normal",
                    !dateRange && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y")} -{" "}
                        {format(dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
       </div>

        <Card>
            <CardHeader className="text-center">
                <CardTitle className="text-2xl">{companyName}</CardTitle>
                <CardDescription>
                    For the period from {dateRange?.from ? format(dateRange.from, 'MMMM d, yyyy') : '...'} to {dateRange?.to ? format(dateRange.to, 'MMMM d, yyyy') : '...'}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {renderContent()}
            </CardContent>
            <CardFooter>
                 <p className="text-xs text-muted-foreground">This report is generated based on categorized transactions. Uncategorized items are not included.</p>
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
