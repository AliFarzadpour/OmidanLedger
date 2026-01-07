
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
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

import { DollarSign, CreditCard, Activity, AlertCircle, Percent, ShoppingBag, Landmark, Banknote, TrendingDown } from 'lucide-react';
import { startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, format, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { OnboardingDashboard } from '@/components/dashboard/OnboardingDashboard';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';

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
  categoryHierarchy?: CategoryHierarchy;
  primaryCategory?: string; // Fallback
  bankAccountId?: string;
  userId?: string; 
};

type BankAccount = {
  id: string;
  accountName?: string;
  bankName?: string;
  accountType?: string;
};

type Property = {
    id: string;
    mortgage?: {
        principalAndInterest?: number;
        escrowAmount?: number;
    }
}

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

function normalizeCategory(tx: Transaction): Required<CategoryHierarchy> {
  const ch = tx.categoryHierarchy ?? {};
  const rawL0 = (ch.l0 ?? tx.primaryCategory ?? '').toString().trim().toUpperCase();

  let l0 = 'EXPENSE'; // Default
  if (rawL0.includes('INCOME')) l0 = 'INCOME';
  else if (rawL0.includes('OPERATING EXPENSE')) l0 = 'OPERATING EXPENSE';
  else if (rawL0.includes('EXPENSE')) l0 = 'EXPENSE';
  else if (rawL0.includes('LIABILITY')) l0 = 'LIABILITY';
  else if (rawL0.includes('ASSET')) l0 = 'ASSET';
  else if (rawL0.includes('EQUITY')) l0 = 'EQUITY';
  
  return {
    l0: l0,
    l1: (ch.l1 || '').trim(),
    l2: (ch.l2 || '').trim(),
    l3: (ch.l3 || '').trim(),
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

  const propertiesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'properties'), where('userId', '==', user.uid));
  }, [firestore, user]);
  const { data: properties, isLoading: isLoadingProperties } = useCollection<Property>(propertiesQuery);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user || !firestore) return;
      setIsLoading(true);
      setError(null);
      try {
        const bankAccountsRef = collection(firestore, `users/${user.uid}/bankAccounts`);
        const bankAccountsSnap = await getDocs(bankAccountsRef);
        const txPromises = bankAccountsSnap.docs.map(async (acct) => {
          const txRef = collection(firestore, `users/${user.uid}/bankAccounts/${acct.id}/transactions`);
          const txQ = query(txRef, where('date', '>=', startDate), where('date', '<=', endDate), orderBy('date', 'desc'), limit(5000));
          const txSnap = await getDocs(txQ);
          return txSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), bankAccountId: acct.id } as Transaction));
        });
        const txNested = await Promise.all(txPromises);
        if (!cancelled) setAllTransactions(txNested.flat());
      } catch (e: any) {
        if (!cancelled) setError(e);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    if (properties && properties.length > 0) load();
    else if (!isLoadingProperties) setIsLoading(false);
    
    return () => { cancelled = true; };
  }, [user, firestore, startDate, endDate, properties, isLoadingProperties]);

  const stats = useMemo(() => {
    const filtered = allTransactions;
    
    let totalIncome = 0;
    let totalExpensesAbs = 0;
    let rentalIncome = 0;
    let operatingExpenses = 0;
    let netIncome = 0;

    const cashFlowMap = new Map<string, { income: number; expense: number }>();
    const expenseBreakdownMap = new Map<string, number>();

    for (const tx of filtered) {
      const amount = Number(tx.amount || 0);
      const dateKey = tx.date;
      const cat = normalizeCategory(tx);
      
      const isOperatingExpense = cat.l0 === 'EXPENSE' || cat.l0 === 'OPERATING EXPENSE';

      if (!cashFlowMap.has(dateKey)) cashFlowMap.set(dateKey, { income: 0, expense: 0 });
      const dayStats = cashFlowMap.get(dateKey)!;

      if (cat.l0 === 'INCOME') {
        totalIncome += amount;
        dayStats.income += amount;
        if (cat.l1.toUpperCase().includes('RENTAL')) {
            rentalIncome += amount;
        }
      } else if (isOperatingExpense) {
          totalExpensesAbs += Math.abs(amount);
          operatingExpenses += Math.abs(amount);
          dayStats.expense += Math.abs(amount);
          const breakdownKey = cat.l1 || 'Uncategorized';
          expenseBreakdownMap.set(breakdownKey, (expenseBreakdownMap.get(breakdownKey) || 0) + Math.abs(amount));
      }
    }
    
    netIncome = totalIncome - totalExpensesAbs;

    const totalDebtPayments = (properties || []).reduce((sum, prop) => {
        return sum + (prop.mortgage?.principalAndInterest || 0) + (prop.mortgage?.escrowAmount || 0);
    }, 0);

    const noi = rentalIncome - operatingExpenses;
    const dscr = totalDebtPayments > 0 ? noi / totalDebtPayments : 0;
    const cashFlowAfterDebt = netIncome - totalDebtPayments;

    const expenseBreakdown = Array.from(expenseBreakdownMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
      
    const cashFlowData = Array.from(cashFlowMap.entries())
      .map(([date, val]) => ({ date, ...val }))
      .sort((a, b) => (a.date > b.date ? 1 : -1));

    return {
      filteredTransactions: filtered.slice(0, 5),
      totalIncome,
      totalExpenses: totalExpensesAbs,
      netIncome,
      profitMargin: totalIncome > 0 ? (netIncome / totalIncome) * 100 : 0,
      noi,
      dscr,
      cashFlowAfterDebt,
      expenseBreakdown,
      cashFlowData,
    };
  }, [allTransactions, properties]);

  const filterOptions: { label: string; value: FilterOption }[] = [
    { label: 'This Month', value: 'this-month' },
    { label: 'Last Month', value: 'last-month' },
    { label: 'This Year', value: 'this-year' },
  ];

  if (isLoadingProperties) {
    return <div className="p-8"><Skeleton className="h-40 w-full" /></div>;
  }

  if (!properties || properties.length === 0) {
    return <OnboardingDashboard />;
  }

  return (
    <TooltipProvider>
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome Back, {user?.email?.split('@')[0] || 'User'}!</h1>
          <p className="text-muted-foreground">Here&apos;s a summary of your financial activity.</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-muted p-1">
          {filterOptions.map(opt => (
            <Button key={opt.value} variant={filter === opt.value ? 'default' : 'ghost'} onClick={() => setFilter(opt.value)} className={cn('w-full transition-all', filter === opt.value && 'shadow-sm')}>
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error.message}</AlertDescription></Alert>}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Tooltip>
          <TooltipTrigger asChild>
            <div><StatCard title="Total Income" value={stats.totalIncome} icon={<DollarSign />} isLoading={isLoading} /></div>
          </TooltipTrigger>
          <TooltipContent><p>All money that came into your accounts.</p></TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <div><StatCard title="Total Expenses" value={stats.totalExpenses} icon={<CreditCard />} isLoading={isLoading} /></div>
          </TooltipTrigger>
          <TooltipContent><p>All money that left your accounts.</p></TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <div><StatCard title="Net Income" value={stats.netIncome} icon={<Activity />} isLoading={isLoading} /></div>
          </TooltipTrigger>
          <TooltipContent><p>Total Income minus Total Expenses.</p></TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
             <div><StatCard title="Cash Flow After Debt" value={stats.cashFlowAfterDebt} icon={<TrendingDown />} isLoading={isLoading} /></div>
          </TooltipTrigger>
          <TooltipContent><p>Net Income after all mortgage payments.</p></TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Card className="shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">DSCR</CardTitle><Landmark className="h-4 w-4 text-muted-foreground"/></CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-8 w-3/4" /> : (
                  <div className="flex items-baseline gap-2">
                    <div className="text-2xl font-bold">{stats.dscr.toFixed(2)}x</div>
                    <Badge variant={stats.dscr >= 1.25 ? 'default' : 'destructive'} className={cn(stats.dscr >= 1.25 && 'bg-green-600')}>{stats.dscr >= 1.25 ? 'Healthy' : 'Risk'}</Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent><p>Debt Service Coverage Ratio (NOI / Debt)</p></TooltipContent>
        </Tooltip>

      </div>
      
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3"><CashFlowChart data={stats.cashFlowData} isLoading={isLoading} /></div>
        <div className="lg:col-span-2 flex flex-col gap-8">
            <ExpenseChart data={stats.expenseBreakdown} isLoading={isLoading} />
        </div>
      </div>
      
      <div className="grid grid-cols-1 gap-8">
          <RecentTransactions transactions={stats.filteredTransactions} isLoading={isLoading} />
      </div>

    </div>
    </TooltipProvider>
  );
}
