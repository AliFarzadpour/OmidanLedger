
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

import { DollarSign, CreditCard, Activity, AlertCircle, Percent, Banknote, Landmark } from 'lucide-react';
import { startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, format, differenceInDays, subYears, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { OnboardingDashboard } from '@/components/dashboard/OnboardingDashboard';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { calculateAmortization } from '@/actions/amortization-actions';

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

type Property = {
    id: string;
    mortgage?: {
        principalAndInterest?: number;
        escrowAmount?: number;
        originalLoanAmount?: number;
        interestRate?: number;
        purchaseDate?: string;
        loanTerm?: number;
    }
}

const getPeriodRanges = (filter: FilterOption) => {
    const now = new Date();
    let currentStart, currentEnd, prevStart, prevEnd;

    switch (filter) {
        case 'this-month':
            currentStart = startOfMonth(now);
            currentEnd = endOfMonth(now);
            prevStart = startOfMonth(subMonths(now, 1));
            prevEnd = endOfMonth(subMonths(now, 1));
            break;
        case 'last-month':
            currentStart = startOfMonth(subMonths(now, 1));
            currentEnd = endOfMonth(subMonths(now, 1));
            prevStart = startOfMonth(subMonths(now, 2));
            prevEnd = endOfMonth(subMonths(now, 2));
            break;
        case 'this-year':
            currentStart = startOfYear(now);
            currentEnd = endOfYear(now);
            prevStart = startOfYear(subYears(now, 1));
            prevEnd = endOfYear(subYears(now, 1));
            break;
    }

    return {
        currentRange: { startDate: format(currentStart, 'yyyy-MM-dd'), endDate: format(currentEnd, 'yyyy-MM-dd') },
        previousRange: { startDate: format(prevStart, 'yyyy-MM-dd'), endDate: format(prevEnd, 'yyyy-MM-dd') }
    };
};

const calculateStats = (transactions: Transaction[], properties: Property[], calculatedInterest: number) => {
    let totalIncome = 0;
    let operatingExpenses = 0;
    let rentalIncome = 0;

    const cashFlowMap = new Map<string, { income: number; expense: number }>();
    const expenseBreakdownMap = new Map<string, number>();

    transactions.forEach(tx => {
        const amount = Number(tx.amount || 0);
        const dateKey = tx.date;
        const l0 = (tx.categoryHierarchy?.l0 || tx.primaryCategory || '').toUpperCase();
        
        const isOpEx = l0 === 'OPERATING EXPENSE';
        const isExpense = l0 === 'EXPENSE';

        if (l0 === 'INCOME') {
            totalIncome += amount;
            if ((tx.categoryHierarchy?.l1 || '').toUpperCase().includes('RENTAL')) {
                rentalIncome += amount;
            }
        } else if (isOpEx || isExpense) {
            operatingExpenses += Math.abs(amount);
            expenseBreakdownMap.set(tx.categoryHierarchy?.l1 || 'Uncategorized', (expenseBreakdownMap.get(tx.categoryHierarchy?.l1 || 'Uncategorized') || 0) + Math.abs(amount));
        }

        if (!cashFlowMap.has(dateKey)) cashFlowMap.set(dateKey, { income: 0, expense: 0 });
        const dayStats = cashFlowMap.get(dateKey)!;
        if (l0 === 'INCOME') {
            dayStats.income += amount;
        } else if (isOpEx || isExpense) {
            dayStats.expense += Math.abs(amount);
        }
    });
    
    const netIncome = totalIncome - operatingExpenses - calculatedInterest;

    const totalDebtPayments = (properties || []).reduce((sum, prop) => {
        return sum + (prop.mortgage?.principalAndInterest || 0) + (prop.mortgage?.escrowAmount || 0);
    }, 0);

    const noi = rentalIncome - operatingExpenses;
    const dscr = totalDebtPayments > 0 ? noi / totalDebtPayments : 0;
    const cashFlowAfterDebt = netIncome - totalDebtPayments;
    
    const expenseBreakdown = Array.from(expenseBreakdownMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const cashFlowData = Array.from(cashFlowMap.entries()).map(([date, val]) => ({ date, ...val })).sort((a, b) => (a.date > b.date ? 1 : -1));

    return {
        filteredTransactions: transactions.slice(0, 5),
        totalIncome,
        operatingExpenses,
        netIncome,
        noi,
        dscr,
        cashFlowAfterDebt,
        expenseBreakdown,
        cashFlowData,
    };
};

const calculateDelta = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
};


export default function DashboardPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const [filter, setFilter] = useState<FilterOption>('this-month');
  const { currentRange, previousRange } = useMemo(() => getPeriodRanges(filter), [filter]);

  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [prevPeriodTransactions, setPrevPeriodTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);
  const [calculatedInterest, setCalculatedInterest] = useState(0);
  const [prevCalculatedInterest, setPrevCalculatedInterest] = useState(0);

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

        const fetchTxsForPeriod = async (start: string, end: string) => {
            const txPromises = bankAccountsSnap.docs.map(async (acct) => {
              const txRef = collection(firestore, `users/${user.uid}/bankAccounts/${acct.id}/transactions`);
              const txQ = query(txRef, where('date', '>=', start), where('date', '<=', end));
              const txSnap = await getDocs(txQ);
              return txSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
            });
            return (await Promise.all(txPromises)).flat();
        };

        const [currentTxs, previousTxs] = await Promise.all([
            fetchTxsForPeriod(currentRange.startDate, currentRange.endDate),
            fetchTxsForPeriod(previousRange.startDate, previousRange.endDate)
        ]);
        
        if (!cancelled) {
          setAllTransactions(currentTxs);
          setPrevPeriodTransactions(previousTxs);
        }
      } catch (e: any) {
        if (!cancelled) setError(e);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    if (properties && properties.length > 0) load();
    else if (!isLoadingProperties) setIsLoading(false);
    
    return () => { cancelled = true; };
  }, [user, firestore, currentRange, previousRange, properties, isLoadingProperties]);

  useEffect(() => {
    async function calculateAllInterest() {
        if (!properties || properties.length === 0) return;
        
        const calculateInterestForPeriod = async (targetDate: Date) => {
            const interestPromises = properties.map(async (prop) => {
                const m = prop.mortgage;
                if (m?.originalLoanAmount && m.interestRate && m.principalAndInterest && m.purchaseDate && m.loanTerm) {
                    const result = await calculateAmortization({
                        principal: m.originalLoanAmount,
                        annualRate: m.interestRate,
                        principalAndInterest: m.principalAndInterest,
                        loanStartDate: m.purchaseDate,
                        loanTermInYears: m.loanTerm,
                        targetDate: targetDate.toISOString(),
                    });
                    return result.success ? (result.interestPaidForMonth || 0) : 0;
                }
                return 0;
            });
            return (await Promise.all(interestPromises)).reduce((sum, current) => sum + current, 0);
        }
        
        const currentInterest = await calculateInterestForPeriod(new Date(currentRange.startDate));
        const prevInterest = await calculateInterestForPeriod(new Date(previousRange.startDate));

        setCalculatedInterest(currentInterest);
        setPrevCalculatedInterest(prevInterest);
    }
    calculateAllInterest();
  }, [properties, currentRange, previousRange]);

  const stats = useMemo(() => calculateStats(allTransactions, properties || [], calculatedInterest), [allTransactions, properties, calculatedInterest]);
  const prevStats = useMemo(() => calculateStats(prevPeriodTransactions, properties || [], prevCalculatedInterest), [prevPeriodTransactions, properties, prevCalculatedInterest]);

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
  
  const dscrBadge = stats.dscr >= 1.25 ? "default" : stats.dscr >= 1.0 ? "outline" : "destructive";
  const dscrColor = stats.dscr >= 1.25 ? "bg-green-600" : stats.dscr >= 1.0 ? "border-amber-500 text-amber-500" : "bg-red-600";

  return (
    <TooltipProvider>
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome Back, {user?.email?.split('@')[0] || 'User'}!</h1>
          <p className="text-muted-foreground">Here&apos;s a summary of your financial activity.</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2 rounded-lg bg-muted p-1">
            {filterOptions.map(opt => (
              <Button 
                key={opt.value} 
                variant={filter === opt.value ? 'default' : 'ghost'} 
                onClick={() => setFilter(opt.value)} 
                className={cn('w-full transition-all', filter === opt.value && 'shadow-sm')}>
                {opt.label}
              </Button>
            ))}
          </div>
           <p className="text-xs text-muted-foreground pr-1">
                {format(parseISO(currentRange.startDate), 'MMM d, yyyy')} – {format(parseISO(currentRange.endDate), 'MMM d, yyyy')}
            </p>
        </div>
      </div>

      {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error.message}</AlertDescription></Alert>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard title="Total Income" value={stats.totalIncome} delta={calculateDelta(stats.totalIncome, prevStats.totalIncome)} icon={<DollarSign />} isLoading={isLoading} cardClassName="bg-green-50 border-green-200" />
        <StatCard title="Operating Expenses" value={stats.operatingExpenses} delta={calculateDelta(stats.operatingExpenses, prevStats.operatingExpenses)} deltaInverted icon={<CreditCard />} isLoading={isLoading} cardClassName="bg-red-50 border-red-200" />
        <StatCard title="Interest Expense" value={calculatedInterest} delta={calculateDelta(calculatedInterest, prevCalculatedInterest)} deltaInverted icon={<Percent />} isLoading={isLoading} cardClassName="bg-amber-50 border-amber-200" />
        <StatCard title="Net Income" value={stats.netIncome} delta={calculateDelta(stats.netIncome, prevStats.netIncome)} icon={<Activity />} isLoading={isLoading} cardClassName="bg-blue-50 border-blue-200" />
        <StatCard title="Cash Flow After Debt" value={stats.cashFlowAfterDebt} delta={calculateDelta(stats.cashFlowAfterDebt, prevStats.cashFlowAfterDebt)} icon={<Banknote />} isLoading={isLoading} cardClassName="bg-indigo-50 border-indigo-200" />
        <Tooltip>
            <TooltipTrigger asChild>
                <Card className="h-full flex flex-col shadow-lg border-2 border-slate-200">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 min-h-[4.5rem]"><CardTitle className="text-sm font-medium">DSCR</CardTitle><Landmark className="h-4 w-4 text-muted-foreground"/></CardHeader>
                    <CardContent className="flex-grow flex flex-col justify-center">
                    {isLoading ? <Skeleton className="h-8 w-3/4" /> : (
                        <div className="flex flex-col items-start gap-1">
                          <div className="text-xl font-bold">{stats.dscr.toFixed(2)}x</div>
                          <Badge variant={dscrBadge} className={cn('w-fit', dscrColor)}>{stats.dscr >= 1.25 ? 'Healthy' : stats.dscr >= 1.0 ? 'Watch' : 'Risk'}</Badge>
                        </div>
                    )}
                    </CardContent>
                </Card>
            </TooltipTrigger>
            <TooltipContent><p>Debt Service Coverage Ratio (NOI / Total Debt Payments). A value above 1.25x is considered healthy.</p></TooltipContent>
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
