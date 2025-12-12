
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collectionGroup, query, where, getDocs } from 'firebase/firestore'; // Removed orderBy from import
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/dashboard/stat-card';
import { ExpenseChart } from '@/components/dashboard/expense-chart';
import { RecentTransactions } from '@/components/dashboard/recent-transactions';
import { DollarSign, CreditCard, Activity, AlertCircle, RefreshCw } from 'lucide-react';
import { startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type Transaction = {
  id: string;
  date: string;
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
  
  // State for data
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 1. Calculate Date Range
  const { startDate, endDate } = useMemo(() => getDateRange(filter), [filter]);

  // ------------------------------------------------------------------
  // 2. DATA FETCHING (The "Diagnostic" Style)
  // ------------------------------------------------------------------
  useEffect(() => {
    async function fetchData() {
        if (!user || !firestore) return;

        setIsLoading(true);
        setError(null);
        console.log("🚀 Starting Fetch...");

        try {
            // "NUCLEAR OPTION" QUERY:
            // 1. No orderBy (Sort in JS)
            // 2. No date filter (Filter in JS)
            // 3. Just "Give me my data".
            const q = query(
                collectionGroup(firestore, 'transactions'),
                where('userId', '==', user.uid)
            );

            const snapshot = await getDocs(q);
            console.log(`✅ Fetched ${snapshot.size} docs`);

            if (snapshot.empty) {
                setAllTransactions([]);
            } else {
                const data = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as Transaction[];
                
                // Sort in memory (Desc Date)
                data.sort((a, b) => (a.date < b.date ? 1 : -1));
                
                setAllTransactions(data);
            }

        } catch (err: any) {
            console.error("Fetch Error:", err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }

    fetchData();
  }, [user, firestore]); // Only re-run if user/firestore loads

  // ------------------------------------------------------------------
  // 3. CLIENT-SIDE FILTERING
  // ------------------------------------------------------------------
  const { filteredTransactions, totalIncome, totalExpenses, netIncome, expenseBreakdown } = useMemo(() => {
    // Filter by date
    const filtered = allTransactions.filter(tx => {
       return tx.date >= startDate && tx.date <= endDate;
    });

    let income = 0;
    let expenses = 0;
    const breakdownMap = new Map<string, number>();

    filtered.forEach(tx => {
      const amount = Number(tx.amount);
      if (amount > 0) {
        income += amount;
      } else {
        expenses += amount;
        const category = tx.primaryCategory || 'Uncategorized';
        breakdownMap.set(category, (breakdownMap.get(category) || 0) + Math.abs(amount));
      }
    });

    const expenseBreakdown = Array.from(breakdownMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    return { 
        filteredTransactions: filtered,
        totalIncome: income, 
        totalExpenses: expenses, 
        netIncome: income + expenses, 
        expenseBreakdown 
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
    <div className="flex flex-col gap-8">
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

      {/* ERROR / EMPTY STATE */}
      {!isLoading && filteredTransactions.length === 0 && (
        <Alert className="bg-blue-50 border-blue-200 text-blue-800">
            <AlertCircle className="h-4 w-4 text-blue-800" />
            <AlertTitle>No Data in this Period</AlertTitle>
            <AlertDescription className="mt-1 text-xs">
                {allTransactions.length > 0 ? (
                    <span>
                        We found <strong>{allTransactions.length} total transactions</strong>, but none match the date range 
                        <strong> {startDate} to {endDate}</strong>. Try "Last Month" or "This Year".
                    </span>
                ) : (
                   <span>No transactions found at all for user <strong>{user?.uid}</strong>.</span>
                )}
            </AlertDescription>
        </Alert>
      )}

      {error && (
         <Alert variant="destructive">
            <AlertTitle>Connection Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
         </Alert>
      )}

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

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <ExpenseChart data={expenseBreakdown} isLoading={isLoading} />
        </div>
        <div className="lg:col-span-3">
          <RecentTransactions transactions={filteredTransactions} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
}
