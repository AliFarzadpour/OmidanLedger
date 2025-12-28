'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUser, useFirestore } from '@/firebase';
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  FirestoreError,
} from 'firebase/firestore';

import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/dashboard/stat-card';
import { ExpenseChart } from '@/components/dashboard/expense-chart';
import { CashFlowChart } from '@/components/dashboard/cash-flow-chart';
import { RecentTransactions } from '@/components/dashboard/recent-transactions';

import { DollarSign, CreditCard, Activity, AlertCircle, Percent, ShoppingBag } from 'lucide-react';
import { startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, format, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type FilterOption = 'this-month' | 'last-month' | 'this-year';

type CategoryHierarchy = {
  l0?: string; // Income | Expense | Transfer | etc
  l1?: string;
  l2?: string;
  l3?: string; // you are using this for vendor/entity in your data
};

type Transaction = {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;

  // New schema
  categoryHierarchy?: CategoryHierarchy;

  // Old schema fallback
  primaryCategory?: string;
  secondaryCategory?: string;
  subcategory?: string;

  bankAccountId?: string;
  userId?: string; // may be missing in older docs
};

type BankAccount = {
  id: string;
  accountName?: string;
  bankName?: string;
  accountType?: string;
};

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

// Normalize mixed schemas into a single “level0/1/2/3” view
function normalizeCategory(tx: Transaction): Required<CategoryHierarchy> {
  const ch = tx.categoryHierarchy ?? {};

  // If new schema is present, trust it
  const l0 = ch.l0 ?? tx.primaryCategory ?? '';
  const l1 = ch.l1 ?? tx.secondaryCategory ?? '';
  const l2 = ch.l2 ?? tx.subcategory ?? '';
  const l3 = ch.l3 ?? ''; // optional

  // Some older data might store Expense/Income as part of primaryCategory differently.
  // Add small normalization here if needed.
  const normL0 =
    l0?.toLowerCase() === 'expenses' ? 'Expense'
    : l0?.toLowerCase() === 'income' ? 'Income'
    : l0;

  return {
    l0: normL0 || 'Uncategorized',
    l1: l1 || 'Uncategorized',
    l2: l2 || 'Uncategorized',
    l3: l3 || '',
  };
}

export default function DashboardPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const [filter, setFilter] = useState<FilterOption>('this-month');
  const { startDate, endDate } = useMemo(() => getDateRange(filter), [filter]);

  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!user || !firestore) return;
      setIsLoading(true);
      setError(null);

      try {
        // 1) Load bank accounts for this user
        const bankAccountsRef = collection(firestore, `users/${user.uid}/bankAccounts`);
        const bankAccountsSnap = await getDocs(bankAccountsRef);

        const bankAccounts: BankAccount[] = bankAccountsSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));

        // 2) For each bank account, load transactions
        // Optional: you can constrain to this date range if your "date" field is ISO string YYYY-MM-DD
        const txPromises = bankAccounts.map(async (acct) => {
          const txRef = collection(firestore, `users/${user.uid}/bankAccounts/${acct.id}/transactions`);

          // If your date strings are consistent YYYY-MM-DD, this range query works
          const txQ = query(
            txRef,
            where('date', '>=', startDate),
            where('date', '<=', endDate),
            orderBy('date', 'desc'),
            limit(5000)
          );

          const txSnap = await getDocs(txQ);
          return txSnap.docs.map((doc) => {
            const data = doc.data() as any;
            return {
              id: doc.id,
              ...data,
              bankAccountId: data.bankAccountId ?? acct.id,
              userId: data.userId ?? user.uid, // fill for runtime use
            } as Transaction;
          });
        });

        const txNested = await Promise.all(txPromises);
        const merged = txNested.flat();

        if (!cancelled) {
          setAllTransactions(merged);
          setIsLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e);
          setIsLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [user, firestore, startDate, endDate]);

  const stats = useMemo(() => {
    const filtered = allTransactions;

    let income = 0;
    let expensesAbs = 0;

    const breakdownMap = new Map<string, number>();
    const cashFlowMap = new Map<string, { income: number; expense: number }>();
    const vendorMap = new Map<string, number>();

    for (const tx of filtered) {
      const amount = Number(tx.amount || 0);
      const dateKey = tx.date;
      const cat = normalizeCategory(tx);

      if (!cashFlowMap.has(dateKey)) cashFlowMap.set(dateKey, { income: 0, expense: 0 });
      const dayStats = cashFlowMap.get(dateKey)!;

      if (cat.l0 === 'Income') {
        // If your income amounts are positive, keep as-is.
        // If some are negative, you can Math.abs() them.
        income += amount;
        dayStats.income += amount;
      } else if (cat.l0 === 'Expense') {
        // Most expense transactions are negative amounts. Normalize to absolute for charts.
        const abs = Math.abs(amount);
        expensesAbs += abs;

        const categoryForBreakdown = cat.l1 || 'Uncategorized';
        breakdownMap.set(categoryForBreakdown, (breakdownMap.get(categoryForBreakdown) || 0) + abs);
        dayStats.expense += abs;

        const vendor = cat.l3 || tx.description?.trim() || 'Unknown';
        vendorMap.set(vendor, (vendorMap.get(vendor) || 0) + abs);
      } else {
        // Transfers or uncategorized: ignore for P&L, or handle separately if you want.
      }
    }

    const netIncome = income - expensesAbs;
    const margin = income > 0 ? (netIncome / income) * 100 : 0;

    const days = Math.max(1, differenceInDays(new Date(endDate), new Date(startDate)) + 1);
    const burnRate = expensesAbs / days;

    const topVendors = Array.from(vendorMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const expenseBreakdown = Array.from(breakdownMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const cashFlowData = Array.from(cashFlowMap.entries())
      .map(([date, val]) => ({ date, ...val }))
      .sort((a, b) => (a.date > b.date ? 1 : -1));

    return {
      filteredTransactions: filtered,
      totalIncome: income,
      totalExpenses: expensesAbs,
      netIncome,
      profitMargin: margin,
      burnRate,
      topVendors,
      expenseBreakdown,
      cashFlowData,
    };
  }, [allTransactions, startDate, endDate]);

  const filterOptions: { label: string; value: FilterOption }[] = [
    { label: 'This Month', value: 'this-month' },
    { label: 'Last Month', value: 'last-month' },
    { label: 'This Year', value: 'this-year' },
  ];

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome Back, {user?.email?.split('@')[0] || 'User'}!
          </h1>
          <p className="text-muted-foreground">Here&apos;s a summary of your financial activity.</p>
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

      {error && (
        <Alert className="bg-red-50 border-red-200 text-red-800">
          <AlertCircle className="h-4 w-4 text-red-800" />
          <AlertTitle>Failed to load transactions</AlertTitle>
          <AlertDescription className="mt-1 text-xs">
            {String((error as any)?.message || error)}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Income" value={stats.totalIncome} icon={<DollarSign className="h-4 w-4 text-muted-foreground" />} isLoading={isLoading} />
        <StatCard title="Total Expenses" value={stats.totalExpenses} icon={<CreditCard className="h-4 w-4 text-muted-foreground" />} isLoading={isLoading} />
        <StatCard title="Net Income" value={stats.netIncome} icon={<Activity className="h-4 w-4 text-muted-foreground" />} isLoading={isLoading} />
        <StatCard title="Profit Margin" value={stats.profitMargin} format="percent" icon={<Percent className="h-4 w-4 text-muted-foreground" />} isLoading={isLoading} />
      </div>

      {!isLoading && stats.filteredTransactions.length === 0 && !error && (
        <Alert className="bg-blue-50 border-blue-200 text-blue-800">
          <AlertCircle className="h-4 w-4 text-blue-800" />
          <AlertTitle>No Data for {startDate} to {endDate}</AlertTitle>
          <AlertDescription className="mt-1 text-xs">
            We found 0 transactions in this period.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <CashFlowChart data={stats.cashFlowData} isLoading={isLoading} />
        </div>
        <div className="lg:col-span-2">
          <ExpenseChart data={stats.expenseBreakdown} isLoading={isLoading} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <RecentTransactions transactions={stats.filteredTransactions} isLoading={isLoading} />
        </div>

        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-purple-500" />
                Top Vendors
              </CardTitle>
              <CardDescription>Who you paid the most.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <Skeleton className="h-5 w-24" />
                      </div>
                      <Skeleton className="h-5 w-16" />
                    </div>
                  ))
                ) : stats.topVendors.length > 0 ? (
                  stats.topVendors.map((v, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                          {i + 1}
                        </div>
                        <span className="text-sm font-medium truncate max-w-[150px]">{v.name}</span>
                      </div>
                      <span className="text-sm font-mono text-slate-600">
                        ${v.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No expenses found.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
