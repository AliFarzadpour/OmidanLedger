
'use client';

import { useState, useMemo, useEffect, useTransition } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs, collectionGroup } from 'firebase/firestore';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowLeft, Landmark, HandCoins, Percent, CalendarDays, Pencil, FileWarning, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { calculateAmortization } from '@/actions/amortization-actions';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';

interface Mortgage {
  hasMortgage?: 'yes' | 'no';
  lenderName?: string;
  loanBalance?: number;
  originalLoanAmount?: number;
  loanTerm?: number; // In years
  principalAndInterest?: number;
  escrowAmount?: number;
  interestRate?: number;
  purchaseDate?: string;
}

interface Property {
  id: string;
  name: string;
  mortgage?: Mortgage;
}

interface CalculatedBalance {
    propertyId: string;
    balance: number;
    interestForMonth: number;
    remainingTermInMonths?: number;
    error?: string;
}

interface Transaction {
    id: string;
    date: string;
    description: string;
    amount: number;
    categoryHierarchy: { l0: string; l1: string; l2: string; l3: string };
    costCenter?: string;
}

function StatCard({ title, value, icon, isLoading, format = 'currency' }: { title: string, value: number, icon: React.ReactNode, isLoading: boolean, format?: 'currency' | 'percent' | 'months' }) {
    let formattedValue;
    if (format === 'currency') {
        formattedValue = formatCurrency(value);
    } else if (format === 'percent') {
        formattedValue = `${value.toFixed(2)}%`;
    } else {
        formattedValue = `${value.toFixed(0)} mos`;
    }

    return (
        <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                {icon}
            </CardHeader>
            <CardContent>
                {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : (
                    <div className="text-2xl font-bold">{formattedValue}</div>
                )}
            </CardContent>
        </Card>
    );
}

export default function DebtCenterPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const [viewingDate, setViewingDate] = useState(new Date());
  const [isPending, startTransition] = useTransition();

  const [balances, setBalances] = useState<CalculatedBalance[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const propertiesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
        collection(firestore, 'properties'), 
        where('userId', '==', user.uid),
        where('mortgage.hasMortgage', '==', 'yes')
    );
  }, [user, firestore]);

  const { data: properties, isLoading: isLoadingProperties } = useCollection<Property>(propertiesQuery);
  
  useEffect(() => {
    if (properties) {
        startTransition(async () => {
            if (!user || !firestore) return;
            const monthStart = format(startOfMonth(viewingDate), 'yyyy-MM-dd');
            const monthEnd = format(endOfMonth(viewingDate), 'yyyy-MM-dd');

            // Fetch transactions for the current month
            const txQuery = query(
                collectionGroup(firestore, 'transactions'), 
                where('userId', '==', user.uid),
                where('date', '>=', monthStart),
                where('date', '<=', monthEnd)
            );
            const txSnap = await getDocs(txQuery);
            const fetchedTransactions = txSnap.docs.map(doc => doc.data() as Transaction);
            setTransactions(fetchedTransactions);

            // Calculate balances
            const balancePromises = properties.map(async p => {
                if (p.mortgage?.originalLoanAmount && p.mortgage.interestRate && p.mortgage.principalAndInterest && p.mortgage.purchaseDate && p.mortgage.loanTerm) {
                    const result = await calculateAmortization({
                        principal: p.mortgage.originalLoanAmount,
                        annualRate: p.mortgage.interestRate,
                        principalAndInterest: p.mortgage.principalAndInterest,
                        loanStartDate: p.mortgage.purchaseDate,
                        loanTermInYears: p.mortgage.loanTerm,
                        targetDate: viewingDate.toISOString(),
                    });
                    return { 
                        propertyId: p.id, 
                        balance: result.currentBalance || 0, 
                        interestForMonth: result.interestPaidForMonth || 0,
                        remainingTermInMonths: result.remainingTermInMonths,
                        error: result.error 
                    };
                }
                return { propertyId: p.id, balance: p.mortgage?.loanBalance || 0, interestForMonth: 0, remainingTermInMonths: (p.mortgage?.loanTerm || 0) * 12 };
            });
            Promise.all(balancePromises).then(setBalances);
        });
    }
  }, [properties, viewingDate, user, firestore]);


  const { totalBalance, totalMonthly, avgInterestRate, totalInterestPaid } = useMemo(() => {
    if (!properties || balances.length === 0) return { totalBalance: 0, totalMonthly: 0, avgInterestRate: 0, totalInterestPaid: 0 };
    
    let balance = 0;
    let monthly = 0;
    let weightedRateSum = 0;
    let interestPaid = 0;

    properties.forEach(p => {
      const calculated = balances.find(b => b.propertyId === p.id);
      const currentBalance = calculated?.balance || 0;
      
      balance += currentBalance;
      monthly += (p.mortgage?.principalAndInterest || 0) + (p.mortgage?.escrowAmount || 0);
      weightedRateSum += (p.mortgage?.interestRate || 0) * currentBalance;
      interestPaid += calculated?.interestForMonth || 0;
    });

    const avgRate = balance > 0 ? weightedRateSum / balance : 0;

    return { totalBalance: balance, totalMonthly: monthly, avgInterestRate: avgRate, totalInterestPaid: interestPaid };
  }, [properties, balances]);

  const handleEdit = (propertyId: string) => {
    router.push(`/dashboard/properties/${propertyId}?tab=mortgage`);
  };
  
  const getActualPayment = (propertyId: string) => {
    const paymentTx = transactions.find(tx => 
        tx.costCenter === propertyId &&
        tx.categoryHierarchy?.l0?.toUpperCase() === 'LIABILITY'
    );
    return paymentTx?.amount || null;
  };

  const isLoading = isLoadingProperties || isPending;

  return (
    <div className="space-y-8 p-8">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/sales')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Debt Center</h1>
            <p className="text-muted-foreground mt-1">A consolidated view of all property-related loans.</p>
          </div>
        </div>
         <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setViewingDate(d => subMonths(d, 1))}>
                <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-semibold text-lg w-36 text-center">{format(viewingDate, 'MMMM yyyy')}</span>
            <Button variant="outline" size="icon" onClick={() => setViewingDate(d => addMonths(d, 1))}>
                <ChevronRight className="h-4 w-4" />
            </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Total Loan Balance" value={totalBalance} icon={<Landmark className="h-5 w-5 text-muted-foreground" />} isLoading={isLoading} />
        <StatCard title="Total Interest Paid" value={totalInterestPaid} icon={<HandCoins className="h-5 w-5 text-muted-foreground" />} isLoading={isLoading} />
        <StatCard title="Total Monthly Payments" value={totalMonthly} icon={<CalendarDays className="h-5 w-5 text-muted-foreground" />} isLoading={isLoading} />
        <StatCard title="Avg. Interest Rate" value={avgInterestRate} icon={<Percent className="h-5 w-5 text-muted-foreground" />} isLoading={isLoading} format="percent" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mortgage Details</CardTitle>
          <CardDescription>A detailed list of all active property loans for the selected month.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property</TableHead>
                <TableHead>Lender</TableHead>
                <TableHead>Original Loan</TableHead>
                <TableHead>Loan Balance</TableHead>
                <TableHead>Interest Paid</TableHead>
                <TableHead>Monthly Payment</TableHead>
                <TableHead>Actual Payment</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Term Left</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={10} className="text-center p-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : properties && properties.length > 0 ? (
                properties.map((prop) => {
                  const monthlyPayment = (prop.mortgage?.principalAndInterest || 0) + (prop.mortgage?.escrowAmount || 0);
                  const currentBalanceInfo = balances.find(b => b.propertyId === prop.id);
                  const actualPayment = getActualPayment(prop.id);
                  return (
                    <TableRow key={prop.id}>
                      <TableCell className="font-medium">{prop.name}</TableCell>
                      <TableCell>{prop.mortgage?.lenderName || 'N/A'}</TableCell>
                      <TableCell>{formatCurrency(prop.mortgage?.originalLoanAmount || 0)}</TableCell>
                      <TableCell>{formatCurrency(currentBalanceInfo?.balance || 0)}</TableCell>
                      <TableCell>{formatCurrency(currentBalanceInfo?.interestForMonth || 0)}</TableCell>
                      <TableCell>{formatCurrency(monthlyPayment)}</TableCell>
                      <TableCell className="font-mono">{actualPayment ? formatCurrency(Math.abs(actualPayment)) : 'N/A'}</TableCell>
                      <TableCell>{(prop.mortgage?.interestRate || 0).toFixed(3)}%</TableCell>
                      <TableCell>{currentBalanceInfo?.remainingTermInMonths || 'N/A'} mos</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(prop.id)}>
                            <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                    <TableCell colSpan={10} className="h-24 text-center">
                        <FileWarning className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                        No properties with mortgage data found.
                    </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
