
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, getDocs, FirestoreError } from 'firebase/firestore'; 
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/dashboard/stat-card';
import { ExpenseChart } from '@/components/dashboard/expense-chart';
import { CashFlowChart } from '@/components/dashboard/cash-flow-chart';
import { RecentTransactions } from '@/components/dashboard/recent-transactions';
import { 
  DollarSign, CreditCard, Activity, AlertCircle, Percent, ShoppingBag 
} from 'lucide-react';
import { startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, format, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FirestorePermissionError, errorEmitter } from '@/firebase/errors';

type Transaction = {
  id: string;
  date: string;
  description: string;
  amount: number;
  primaryCategory: string;
  secondaryCategory?: string;
  subcategory?: string;
  userId: string;
  bankAccountId?: string;
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
    case 'last-month':
      const lastMonth = subMonths(now, 1);
      return {
        startDate: format(startOfMonth(lastMonth), 'yyyy-MM-dd'),
        endDate: format(endOfMonth(lastMonth), 'yyyy-MM-dd'),
      };
    case 'this-year':
      return {
        startDate: format(startOfYear(now), 'yyyy-MM-dd'),
        endDate: format(endOfYear(now), 'yyyy-MM-dd'),
      };
  }
};

export default function DashboardPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [filter, setFilter] = useState<FilterOption>('this-month');
  
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { startDate, endDate } = useMemo(() => getDateRange(filter), [filter]);

  const fetchData = useCallback(async () => {
    if (!user || !firestore) return;
    setIsLoading(true);
    setError(null);

    try {
      const bankAccountsQuery = query(collection(firestore, `users/${user.uid}/bankAccounts`));
      const bankAccountsSnap = await getDocs(bankAccountsQuery);
      
      const allTxPromises = bankAccountsSnap.docs.map(async (accountDoc) => {
        const transactionsQuery = query(collection(firestore, `users/${user.uid}/bankAccounts/${accountDoc.id}/transactions`));
        const transactionsSnap = await getDocs(transactionsQuery);
        return transactionsSnap.docs.map(txDoc => ({ 
            id: txDoc.id, 
            ...txDoc.data(),
            bankAccountId: accountDoc.id 
        })) as Transaction[];
      });

      const allTxArrays = await Promise.all(allTxPromises);
      const combinedTransactions = allTxArrays.flat();
      
      combinedTransactions.sort((a, b) => (new Date(b.date + 'T00:00:00').getTime() - new Date(a.date + 'T00:00:00').getTime()));
      setAllTransactions(combinedTransactions);

    } catch (err: any) {
        console.error("Fetch Error:", err);
        let message = 'An unknown error occurred while fetching data.';
        if (err instanceof FirestoreError) {
          message = err.message;
        } else if (err.message) {
          message = err.message;
        }
        setError(message);
    } finally {
        setIsLoading(false);
    }
  }, [user, firestore]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 2. CALCULATIONS (Added New KPIs)
  const stats = useMemo(() => {
    const filtered = allTransactions.filter(tx => {
        const txDate = new Date(tx.date + 'T00:00:00');
        return txDate >= new Date(startDate + 'T00:00:00') && txDate <= new Date(endDate + 'T00:00:00');
    });

    let income = 0;
    let expenses = 0;
    const breakdownMap = new Map<string, number>();
    const cashFlowMap = new Map<string, { income: number, expense: number }>();
    const vendorMap = new Map<string, number>();

    filtered.forEach(tx => {
      const amount = Number(tx.amount);
      const dateKey = tx.date; // YYYY-MM-DD

      // Initialize daily map
      if (!cashFlowMap.has(dateKey)) cashFlowMap.set(dateKey, { income: 0, expense: 0 });
      const dayStats = cashFlowMap.get(dateKey)!;

      if (amount > 0) {
        income += amount;
        dayStats.income += amount;
      } else {
        expenses += amount;
        dayStats.expense += Math.abs(amount);
        
        // Category Logic
        const category = tx.primaryCategory || 'Uncategorized';
        breakdownMap.set(category, (breakdownMap.get(category) || 0) + Math.abs(amount));

        // Vendor Logic (Clean the description string slightly for grouping)
        const vendor = tx.description?.trim() || 'Unknown';
        vendorMap.set(vendor, (vendorMap.get(vendor) || 0) + Math.abs(amount));
      }
    });

    // KPI 1: Profit Margin
    const margin = income > 0 ? (income + expenses) / income * 100 : 0;

    // KPI 2: Burn Rate (Avg Daily Spend)
    const days = Math.max(1, differenceInDays(new Date(endDate), new Date(startDate)) + 1);
    const burnRate = Math.abs(expenses) / days;

    // KPI 3: Top Vendors
    const topVendors = Array.from(vendorMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5); // Top 5

    // Chart Data Preparation
    const expenseBreakdown = Array.from(breakdownMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    // Cash Flow Chart Data (Sorted by date)
    const cashFlowData = Array.from(cashFlowMap.entries())
        .map(([date, val]) => ({ date, ...val }))
        .sort((a, b) => (a.date > b.date ? 1 : -1));

    return { 
        filteredTransactions: filtered,
        totalIncome: income, 
        totalExpenses: expenses, 
        netIncome: income + expenses,
        profitMargin: margin,
        burnRate,
        topVendors,
        expenseBreakdown,
        cashFlowData
    };
  }, [allTransactions, startDate, endDate]);

  const filterOptions: { label: string, value: FilterOption }[] = [
      { label: 'This Month', value: 'this-month' },
      { label: 'Last Month', value: 'last-month' },
      { label: 'This Year', value: 'this-year' },
  ]

  // ------------------------------------------------------------------
  // RENDER
  // ------------------------------------------------------------------
  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome Back, {user?.email?.split('@')[0] || 'User'}!</h1>
          <p className="text-muted-foreground">Here&apos;s a summary of your financial activity.</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-muted p-1">
            {filterOptions.map(opt => (
                <Button 
                    key={opt.value}
                    variant={filter === opt.value ? 'default' : 'ghost'}
                    onClick={() => setFilter(opt.value)}
                    className={cn("w-full transition-all", filter === opt.value && "shadow-sm")}
                >
                    {opt.label}
                </Button>
            ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Income"
          value={stats.totalIncome}
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
          isLoading={isLoading}
        />
        <StatCard
          title="Total Expenses"
          value={stats.totalExpenses}
          icon={<CreditCard className="h-4 w-4 text-muted-foreground" />}
          isLoading={isLoading}
        />
        <StatCard
          title="Net Income"
          value={stats.netIncome}
          icon={<Activity className="h-4 w-4 text-muted-foreground" />}
          isLoading={isLoading}
        />
        <StatCard
          title="Profit Margin"
          value={stats.profitMargin}
          format="percent"
          icon={<Percent className="h-4 w-4 text-muted-foreground" />}
          isLoading={isLoading}
        />
      </div>


      {!isLoading && stats.filteredTransactions.length === 0 && (
        <Alert className="bg-blue-50 border-blue-200 text-blue-800">
            <AlertCircle className="h-4 w-4 text-blue-800" />
            <AlertTitle>No Data for {startDate} to {endDate}</AlertTitle>
            <AlertDescription className="mt-1 text-xs">
                We found {allTransactions.length} total transactions, but none in this period. 
            </AlertDescription>
        </Alert>
      )}

      {/* CHARTS ROW */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        {/* NEW: Cash Flow Bar Chart */}
        <div className="lg:col-span-3">
          <CashFlowChart data={stats.cashFlowData} isLoading={isLoading} />
        </div>
        {/* EXISTING: Expense Pie Chart */}
        <div className="lg:col-span-2">
          <ExpenseChart data={stats.expenseBreakdown} isLoading={isLoading} />
        </div>
      </div>

      {/* BOTTOM ROW: Recent Tx + Top Vendors */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <RecentTransactions transactions={stats.filteredTransactions} isLoading={isLoading} />
        </div>
        
        {/* NEW: Top Vendors Card */}
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
    