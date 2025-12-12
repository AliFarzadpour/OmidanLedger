'use client';

import { useState, useMemo } from 'react';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { collectionGroup, query, where } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/dashboard/stat-card';
import { ExpenseChart } from '@/components/dashboard/expense-chart';
import { RecentTransactions } from '@/components/dashboard/recent-transactions';
import { DollarSign, CreditCard, Activity, AlertCircle } from 'lucide-react';
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfYear,
  endOfYear,
  format,
} from 'date-fns';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type Transaction = {
  id: string;
  date: string | { seconds: number; nanoseconds: number }; // string or Firestore Timestamp
  description: string;
  amount: number;
  primaryCategory: string;
  secondaryCategory?: string;
  subcategory?: string;
  userId: string;
};

type FilterOption = 'this-month' | 'last-month' | 'this-year';

const getDateRange = (filter: FilterOption) => {
  const now = new Date();
  switch (filter) {
    case 'this-month':
      return {
        startDate: format(startOfMonth(now), 'yyyy-MM-dd'),
        endDate: format(endOfMonth(now), 'yyyy-MM-dd'),
      };
    case 'last-month': {
      const lastMonth = subMonths(now, 1);
      return {
        startDate: format(startOfMonth(lastMonth), 'yyyy-MM-dd'),
        endDate: format(endOfMonth(lastMonth), 'yyyy-MM-dd'),
      };
    }
    case 'this-year':
      return {
        startDate: format(startOfYear(now), 'yyyy-MM-dd'),
        endDate: format(endOfYear(now), 'yyyy-MM-dd'),
      };
  }
};

function normalizeDateToString(d: Transaction['date']): string {
  if (typeof d === 'string') return d;
  if (d && typeof d === 'object' && 'seconds' in d) {
    const jsDate = new Date(d.seconds * 1000);
    return format(jsDate, 'yyyy-MM-dd');
  }
  return '';
}

export default function DashboardPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [filter, setFilter] = useState<FilterOption>('this-month');

  const { startDate, endDate } = useMemo(() => getDateRange(filter), [filter]);

  // -------------------------------------------------------
  // FIRESTORE QUERY
  // -------------------------------------------------------
  const transactionsQuery = useMemo(() => {
    if (!user || !firestore) return null;

    console.log('🔍 Querying transactions for userId:', user.uid);

    return query(
      collectionGroup(firestore, 'transactions'),
      where('userId', '==', user.uid)
    );
  }, [user?.uid, firestore]);

  const { data: transactions, isLoading, error } =
    useCollection<Transaction>(transactionsQuery);

  if (!isLoading && transactions) {
    console.log('✅ Fetched transactions:', transactions);
  }

  // -------------------------------------------------------
  // STATS CALCULATION
  // -------------------------------------------------------
  const {
    totalIncome,
    totalExpenses,
    netIncome,
    expenseBreakdown,
    filteredTransactions,
  } = useMemo(() => {
    if (!transactions) {
      return {
        totalIncome: 0,
        totalExpenses: 0,
        netIncome: 0,
        expenseBreakdown: [] as { name: string; value: number }[],
        filteredTransactions: [] as Transaction[],
      };
    }

    const filtered = transactions.filter((tx) => {
      const dateStr = normalizeDateToString(tx.date);
      return dateStr >= startDate && dateStr <= endDate;
    });

    let income = 0;
    let expenses = 0;
    const breakdownMap = new Map<string, number>();

    filtered.forEach((tx) => {
      const amount = Number(tx.amount);
      if (amount > 0) {
        income += amount;
      } else {
        expenses += amount;
        const category = tx.primaryCategory || 'Uncategorized';
        breakdownMap.set(category, (breakdownMap.get(category) || 0) + Math.abs(amount));
      }
    });

    const breakdown = Array.from(breakdownMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    return {
      totalIncome: income,
      totalExpenses: expenses,
      netIncome: income + expenses,
      expenseBreakdown: breakdown,
      filteredTransactions: filtered,
    };
  }, [transactions, startDate, endDate]);

  const filterOptions: { label: string; value: FilterOption }[] = [
    { label: 'This Month', value: 'this-month' },
    { label: 'Last Month', value: 'last-month' },
    { label: 'This Year', value: 'this-year' },
  ];

  // -------------------------------------------------------
  // RENDER
  // -------------------------------------------------------
  return (
    <div className="flex flex-col gap-8">
      {/* Header + Filter */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome Back, {user?.email?.split('@')[0] || 'User'}!
          </h1>
          <p className="text-muted-foreground">
            Here&apos;s a summary of your financial activity.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-muted p-1">
          {filterOptions.map((opt) => (
            <Button
              key={opt.value}
              variant={filter === opt.value ? 'default' : 'ghost'}
              onClick={() => setFilter(opt.value)}
              className={cn('w-full transition-all', filter === opt.value && 'shadow-sm')}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Diagnostic Alert if no data */}
      {!isLoading && (transactions?.length ?? 0) === 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No Transactions Found</AlertTitle>
          <AlertDescription className="mt-2 text-xs font-mono space-y-1">
            <p>
              We didn&apos;t find any documents in the <code>transactions</code> collection
              group for this user.
            </p>
            <p>User ID: {user?.uid}</p>
            {error && <p className="mt-2 text-red-600 font-bold">Error: {error.message}</p>}
            <p className="mt-2">
              Check Firestore data and security rules. Make sure each transaction has a{' '}
              <code>userId</code> field equal to this user&apos;s UID.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Net Income"
          value={netIncome}
          icon={<Activity className="h-6 w-6 text-primary" />}
          isLoading={isLoading}
        />
        <StatCard
          title="Total Income"
          value={totalIncome}
          icon={<DollarSign className="h-6 w-6 text-green-500" />}
          isLoading={isLoading}
        />
        <StatCard
          title="Total Expenses"
          value={totalExpenses}
          icon={<CreditCard className="h-6 w-6 text-red-500" />}
          isLoading={isLoading}
        />
      </div>

      {/* Chart + Recent Transactions */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <ExpenseChart data={expenseBreakdown} isLoading={isLoading} />
        </div>
        <div className="lg:col-span-3">
          <RecentTransactions
            transactions={filteredTransactions}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}
