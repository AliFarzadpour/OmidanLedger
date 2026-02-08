'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, getDocs, query, collectionGroup, where, writeBatch, doc } from 'firebase/firestore';
import { parseISO, isWithinInterval, startOfYear, endOfYear, eachMonthOfInterval, format, startOfQuarter, endOfQuarter, startOfMonth, endOfMonth, subYears, subQuarters, subMonths, addDays } from 'date-fns';
import { formatCurrency } from '@/lib/format';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlayCircle, AlertCircle, Loader2, ChevronsRight } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ProfitAndLossDrawer } from './profit-and-loss-drawer';
import { InterestDetailDrawer } from './InterestDetailDrawer'; // NEW IMPORT
import type { Transaction } from '@/components/dashboard/transactions-table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { calculateAmortization } from '@/actions/amortization-actions';

// Helper: normalize Firestore Timestamp OR string to JS Date (or null)
function toDate(value: any): Date | null {
  if (!value) return null;
  if (typeof value === 'object' && typeof value.toDate === 'function') return value.toDate();
  if (typeof value === 'string') {
    const d = parseISO(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function MonthlyBreakdownReport({ reportData }: { reportData: MonthlyReportData }) {
    const { months, incomeByCategory, expensesByCategory, monthlyTotals } = reportData;
  
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[250px]">Category</TableHead>
            {months.map(month => (
              <TableHead key={month} className="text-right">{format(parseISO(month), 'MMM yyyy')}</TableHead>
            ))}
            <TableHead className="text-right font-bold">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* INCOME */}
          <TableRow className="bg-green-50 font-bold border-b-2 border-green-200">
            <TableCell colSpan={months.length + 2} className="text-green-800 text-base">INCOME</TableCell>
          </TableRow>
          {Object.entries(incomeByCategory).map(([category, monthlyValues]) => (
            <TableRow key={category}>
              <TableCell className="pl-8 text-muted-foreground">{category}</TableCell>
              {months.map(month => (
                <TableCell key={month} className="text-right font-mono">{formatCurrency(monthlyValues[month] || 0)}</TableCell>
              ))}
              <TableCell className="text-right font-bold font-mono">{formatCurrency(Object.values(monthlyValues).reduce((a, b) => a + b, 0))}</TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-green-50/50 font-semibold">
            <TableCell>Total Income</TableCell>
            {months.map(month => (
              <TableCell key={month} className="text-right font-mono font-bold text-green-700">{formatCurrency(monthlyTotals[month]?.income || 0)}</TableCell>
            ))}
            <TableCell className="text-right font-bold font-mono text-green-700">{formatCurrency(reportData.totalInc)}</TableCell>
          </TableRow>

          <TableRow className="h-8"><TableCell colSpan={months.length + 2} /></TableRow>
          
          {/* EXPENSES */}
          <TableRow className="bg-red-50 font-bold border-b-2 border-red-200">
            <TableCell colSpan={months.length + 2} className="text-red-800 text-base">EXPENSES</TableCell>
          </TableRow>
          {Object.entries(expensesByCategory).map(([category, monthlyValues]) => (
            <TableRow key={category}>
              <TableCell className="pl-8 text-muted-foreground">{category}</TableCell>
              {months.map(month => (
                <TableCell key={month} className="text-right font-mono">({formatCurrency(monthlyValues[month] || 0)})</TableCell>
              ))}
              <TableCell className="text-right font-bold font-mono">({formatCurrency(Object.values(monthlyValues).reduce((a, b) => a + b, 0))})</TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-red-50/50 font-semibold">
            <TableCell>Total Expenses</TableCell>
            {months.map(month => (
              <TableCell key={month} className="text-right font-mono font-bold text-red-700">({formatCurrency(monthlyTotals[month]?.expenses || 0)})</TableCell>
            ))}
            <TableCell className="text-right font-bold font-mono text-red-700">({formatCurrency(reportData.totalExp)})</TableCell>
          </TableRow>

          {/* NET INCOME */}
           <TableRow className="border-t-4 border-double font-black text-lg bg-slate-100">
            <TableCell>NET OPERATING INCOME</TableCell>
             {months.map(month => {
                const net = (monthlyTotals[month]?.income || 0) - (monthlyTotals[month]?.expenses || 0);
                return (
                    <TableCell key={month} className={`text-right font-mono ${net >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(net)}</TableCell>
                )
             })}
             <TableCell className={`text-right font-mono ${reportData.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(reportData.net)}</TableCell>
          </TableRow>

        </TableBody>
      </Table>
    );
  }

interface SummaryReportData {
    income: { name: string; total: number; transactions: Transaction[] }[];
    expenses: { name: string; total: number; transactions: Transaction[] }[];
    totalInc: number;
    totalExp: number;
    net: number;
}

interface MonthlyReportData {
    months: string[];
    incomeByCategory: Record<string, Record<string, number>>;
    expensesByCategory: Record<string, Record<string, number>>;
    monthlyTotals: Record<string, { income: number; expenses: number }>;
    totalInc: number;
    totalExp: number;
    net: number;
}

// NEW
export interface InterestCalculationDetail {
  propertyId: string;
  propertyName: string;
  month: string;
  interest: number;
}

export function ProfitAndLossReport() {
  const { user } = useUser();
  const firestore = useFirestore();

  const [dates, setDates] = useState({ from: '', to: '' });
  const [activeRange, setActiveRange] = useState({ from: '', to: '' });
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [calculatedInterestDetails, setCalculatedInterestDetails] = useState<InterestCalculationDetail[]>([]); // NEW
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isInterestDrawerOpen, setIsInterestDrawerOpen] = useState(false); // NEW
  const [selectedCategory, setSelectedCategory] = useState<{ name: string; transactions: Transaction[] } | null>(null);

  useEffect(() => {
    const today = new Date();
    const from = startOfMonth(today);
    const to = endOfMonth(today);
    const initialDates = {
      from: format(from, 'yyyy-MM-dd'),
      to: format(to, 'yyyy-MM-dd')
    };
    setDates(initialDates);
    setActiveRange(initialDates);
  }, []);

  const fetchData = useCallback(async () => {
    if (!user || !firestore) return;
    setIsLoading(true);
    setError(null);
    try {
      // Fetch all data concurrently
      const [txsSnap, propsSnap] = await Promise.all([
        getDocs(query(collectionGroup(firestore, 'transactions'), where('userId', '==', user.uid))),
        getDocs(query(collection(firestore, 'properties'), where('userId', '==', user.uid)))
      ]);

      const fetchedTxs = txsSnap.docs.map(d => ({ ...d.data(), id: d.id, bankAccountId: d.ref.parent.parent?.id }));
      setAllTransactions(fetchedTxs);
      
      const fetchedProps = propsSnap.docs.map(d => ({ ...d.data(), id: d.id }));
      setProperties(fetchedProps);

    } catch (e: any) {
      console.error(e);
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [user, firestore]);

  useEffect(() => { fetchData(); }, [fetchData]);
  
  useEffect(() => {
    const calculateAllInterest = async () => {
        if (!properties.length || !activeRange.from || !activeRange.to) return;
        
        const fromD = parseISO(activeRange.from);
        const toD = parseISO(activeRange.to);
        const months = eachMonthOfInterval({ start: fromD, end: toD });
        const interestDetails: InterestCalculationDetail[] = [];
        
        for (const prop of properties) {
            if (prop.mortgage?.originalLoanAmount && prop.mortgage.interestRate && prop.mortgage.principalAndInterest && prop.mortgage.purchaseDate && prop.mortgage.loanTerm) {
                for (const monthDate of months) {
                    const result = await calculateAmortization({
                        principal: prop.mortgage.originalLoanAmount,
                        annualRate: prop.mortgage.interestRate,
                        principalAndInterest: prop.mortgage.principalAndInterest,
                        loanStartDate: prop.mortgage.purchaseDate,
                        loanTermInYears: prop.mortgage.loanTerm,
                        targetDate: monthDate.toISOString(),
                    });
                    
                    if (result.success && result.interestPaidForMonth) {
                         interestDetails.push({
                            propertyId: prop.id,
                            propertyName: prop.name,
                            month: format(monthDate, 'yyyy-MM'),
                            interest: result.interestPaidForMonth
                        });
                    }
                }
            }
        }
        setCalculatedInterestDetails(interestDetails);
    };

    calculateAllInterest();
  }, [properties, activeRange]);

  const summaryReportData: SummaryReportData = useMemo(() => {
    const empty = { income: [], expenses: [], totalInc: 0, totalExp: 0, net: 0 };
    if (!allTransactions.length || !activeRange.from || !activeRange.to) return empty;
    const fromD = parseISO(activeRange.from);
    const toD = addDays(parseISO(activeRange.to), 0); // Corrected: Use 0 to not include next day
    const incMap = new Map<string, { total: number; transactions: Transaction[] }>();
    const expMap = new Map<string, { total: number; transactions: Transaction[] }>();
    let totalInc = 0, totalExp = 0;
    
    allTransactions.forEach(tx => {
      const d = toDate(tx.date);
      if (!d || !isWithinInterval(d, { start: fromD, end: toD })) return;
      
      const h = tx.categoryHierarchy || {};
      const primaryCategory = (h.l0 || tx.primaryCategory || '').toUpperCase();
      
      if (primaryCategory !== 'INCOME' && primaryCategory !== 'EXPENSE' && primaryCategory !== 'OPERATING EXPENSE') return;

      const rawAmount = Number(tx.amount) || 0;
      const label = h.l2 || h.l1 || 'Other';
      
      if (primaryCategory === 'INCOME') {
        totalInc += rawAmount;
        const current = incMap.get(label) || { total: 0, transactions: [] };
        current.total += rawAmount;
        current.transactions.push(tx);
        incMap.set(label, current);
      } else {
        totalExp += Math.abs(rawAmount);
        const current = expMap.get(label) || { total: 0, transactions: [] };
        current.total += Math.abs(rawAmount);
        current.transactions.push(tx);
        expMap.set(label, current);
      }
    });

    const totalInterest = calculatedInterestDetails.reduce((sum, item) => sum + item.interest, 0);
    expMap.set("Mortgage Interest (Calculated)", { total: totalInterest, transactions: [] });
    totalExp += totalInterest;

    return {
      income: Array.from(incMap.entries()).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.total - a.total),
      expenses: Array.from(expMap.entries()).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.total - a.total),
      totalInc,
      totalExp,
      net: totalInc - totalExp
    };
  }, [allTransactions, activeRange, calculatedInterestDetails]);

  const monthlyReportData: MonthlyReportData = useMemo(() => {
    const empty = { months: [], incomeByCategory: {}, expensesByCategory: {}, monthlyTotals: {}, totalInc: 0, totalExp: 0, net: 0 };
    if (!allTransactions.length || !activeRange.from || !activeRange.to) return empty;

    const fromD = parseISO(activeRange.from);
    const toD = addDays(parseISO(activeRange.to), 0); // Corrected: Use 0 to not include next day
    const months = eachMonthOfInterval({ start: fromD, end: toD }).map(d => format(d, 'yyyy-MM'));

    const incomeByCategory: Record<string, Record<string, number>> = {};
    const expensesByCategory: Record<string, Record<string, number>> = {};
    const monthlyTotals: Record<string, { income: number; expenses: number }> = {};
    months.forEach(m => monthlyTotals[m] = { income: 0, expenses: 0 });

    allTransactions.forEach(tx => {
        const d = toDate(tx.date);
        if (!d || !isWithinInterval(d, { start: fromD, end: toD })) return;
        
        const monthKey = format(d, 'yyyy-MM');
        const h = tx.categoryHierarchy || {};
        const primaryCategory = (h.l0 || tx.primaryCategory || '').toUpperCase();
        
        if (primaryCategory !== 'INCOME' && primaryCategory !== 'EXPENSE' && primaryCategory !== 'OPERATING EXPENSE') return;

        const rawAmount = Number(tx.amount) || 0;
        const label = h.l2 || h.l1 || 'Other';

        if (primaryCategory === 'INCOME') {
            monthlyTotals[monthKey].income += rawAmount;
            if (!incomeByCategory[label]) incomeByCategory[label] = {};
            incomeByCategory[label][monthKey] = (incomeByCategory[label][monthKey] || 0) + rawAmount;
        } else {
            monthlyTotals[monthKey].expenses += Math.abs(rawAmount);
            if (!expensesByCategory[label]) expensesByCategory[label] = {};
            expensesByCategory[label][monthKey] = (expensesByCategory[label][monthKey] || 0) + Math.abs(rawAmount);
        }
    });

    const interestCategoryName = "Mortgage Interest (Calculated)";
    if (!expensesByCategory[interestCategoryName]) {
        expensesByCategory[interestCategoryName] = {};
    }
    
    calculatedInterestDetails.forEach(item => {
        if (monthlyTotals[item.month]) {
            monthlyTotals[item.month].expenses += item.interest;
        }
        if(!expensesByCategory[interestCategoryName]) expensesByCategory[interestCategoryName] = {};
        expensesByCategory[interestCategoryName][item.month] = (expensesByCategory[interestCategoryName][item.month] || 0) + item.interest;
    });

    const totalInc = Object.values(monthlyTotals).reduce((sum, m) => sum + m.income, 0);
    const totalExp = Object.values(monthlyTotals).reduce((sum, m) => sum + m.expenses, 0);

    return { months, incomeByCategory, expensesByCategory, monthlyTotals, totalInc, totalExp, net: totalInc - totalExp };
  }, [allTransactions, activeRange, calculatedInterestDetails]);


  const handleRowClick = (name: string, transactions: Transaction[]) => {
    if (name === 'Mortgage Interest (Calculated)') {
        setIsInterestDrawerOpen(true);
    } else {
        setSelectedCategory({ name, transactions });
        setIsDrawerOpen(true);
    }
  };

  const handleUpdate = () => {
    fetchData(); // Refetch all data
    setIsDrawerOpen(false); // Close the drawer
  };

  const setDateRange = (range: 'thisMonth' | 'thisQuarter' | 'thisYear' | 'lastMonth' | 'lastQuarter' | 'lastYear') => {
    const today = new Date();
    let from, to;

    switch (range) {
        case 'thisMonth':
            from = startOfMonth(today);
            to = endOfMonth(today);
            break;
        case 'thisQuarter':
            from = startOfQuarter(today);
            to = endOfQuarter(today);
            break;
        case 'thisYear':
            from = startOfYear(today);
            to = endOfYear(today);
            break;
        case 'lastMonth':
            from = startOfMonth(subMonths(today, 1));
            to = endOfMonth(subMonths(today, 1));
            break;
        case 'lastQuarter':
            from = startOfQuarter(subQuarters(today, 1));
            to = endOfQuarter(subQuarters(today, 1));
            break;
        case 'lastYear':
            from = startOfYear(subYears(today, 1));
            to = endOfYear(subYears(today, 1));
            break;
    }
    
    setDates({ from: format(from, 'yyyy-MM-dd'), to: format(to, 'yyyy-MM-dd') });
  };


  if (error) return <Alert variant="destructive" className="m-8"><AlertCircle className="h-4 w-4" /><AlertTitle>Firestore Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>;

  return (
    <>
      <div className="p-8 space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-end gap-4 bg-muted/50 p-6 rounded-xl border">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
                <div className="grid gap-2"><Label>Start Date</Label><Input type="date" value={dates.from} onChange={e => setDates(d => ({ ...d, from: e.target.value }))} /></div>
                <div className="grid gap-2"><Label>End Date</Label><Input type="date" value={dates.to} onChange={e => setDates(d => ({ ...d, to: e.target.value }))} /></div>
            </div>
             <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setDateRange('thisMonth')}>This Month</Button>
                <Button variant="outline" size="sm" onClick={() => setDateRange('thisQuarter')}>This Quarter</Button>
                <Button variant="outline" size="sm" onClick={() => setDateRange('thisYear')}>This Year</Button>
                <div className="border-l mx-2"/>
                <Button variant="outline" size="sm" onClick={() => setDateRange('lastMonth')}>Last Month</Button>
                <Button variant="outline" size="sm" onClick={() => setDateRange('lastQuarter')}>Last Quarter</Button>
                <Button variant="outline" size="sm" onClick={() => setDateRange('lastYear')}>Last Year</Button>
            </div>
          </div>
          <Button onClick={() => setActiveRange({ ...dates })} disabled={isLoading}>{isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}Run Report</Button>
        </div>

        <Tabs defaultValue="summary">
            <TabsList>
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="monthly">Monthly Breakdown</TabsTrigger>
            </TabsList>
            <TabsContent value="summary" className="mt-4">
                <Card className="shadow-lg border-t-4 border-t-primary">
                <CardHeader className="border-b bg-slate-50/50 text-center">
                    <CardTitle className="text-3xl font-bold">Profit &amp; Loss Statement</CardTitle>
                    <CardDescription className="font-mono text-sm uppercase tracking-widest">{activeRange.from} TO {activeRange.to}</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                    {isLoading ? <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : (
                    <Table>
                        <TableBody>
                        <TableRow className="bg-green-50 font-bold border-b-2 border-green-200"><TableCell className="text-green-800 text-lg">TOTAL INCOME</TableCell><TableCell className="text-right text-green-800 text-lg">{formatCurrency(summaryReportData.totalInc)}</TableCell></TableRow>
                        {summaryReportData.income.length ? summaryReportData.income.map(i => <TableRow key={i.name} onClick={() => handleRowClick(i.name, i.transactions)} className="cursor-pointer hover:bg-slate-50"><TableCell className="pl-8 text-muted-foreground">{i.name}</TableCell><TableCell className="text-right flex justify-end items-center gap-2">{formatCurrency(i.total)} <ChevronsRight className="h-4 w-4 text-slate-300" /></TableCell></TableRow>) : <TableRow><TableCell colSpan={2} className="text-center py-4 text-xs italic text-muted-foreground">No income found.</TableCell></TableRow>}
                        <TableRow className="h-8"><TableCell colSpan={2} /></TableRow>
                        <TableRow className="bg-red-50 font-bold border-b-2 border-red-200"><TableCell className="text-red-800 text-lg">TOTAL EXPENSES</TableCell><TableCell className="text-right text-red-800 text-lg">({formatCurrency(summaryReportData.totalExp)})</TableCell></TableRow>
                        {summaryReportData.expenses.length ? summaryReportData.expenses.map(e => <TableRow key={e.name} onClick={() => handleRowClick(e.name, e.transactions)} className="cursor-pointer hover:bg-slate-50"><TableCell className="pl-8 text-muted-foreground">{e.name}</TableCell><TableCell className="text-right flex justify-end items-center gap-2">{formatCurrency(e.total)} <ChevronsRight className="h-4 w-4 text-slate-300" /></TableCell></TableRow>) : <TableRow><TableCell colSpan={2} className="text-center py-4 text-xs italic text-muted-foreground">No expenses found.</TableCell></TableRow>}
                        <TableRow className="border-t-4 border-double font-black text-2xl bg-slate-100"><TableCell>NET OPERATING INCOME</TableCell><TableCell className={`text-right ${summaryReportData.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(summaryReportData.net)}</TableCell></TableRow>
                        </TableBody>
                    </Table>
                    )}
                </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="monthly" className="mt-4">
                <Card className="shadow-lg border-t-4 border-t-primary">
                    <CardHeader className="border-b bg-slate-50/50 text-center">
                        <CardTitle className="text-3xl font-bold">Monthly Profit &amp; Loss</CardTitle>
                        <CardDescription className="font-mono text-sm uppercase tracking-widest">{activeRange.from} TO {activeRange.to}</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                        {isLoading ? <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : (
                            <MonthlyBreakdownReport reportData={monthlyReportData} />
                        )}
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
      </div>
      {selectedCategory && <ProfitAndLossDrawer isOpen={isDrawerOpen} onOpenChange={setIsDrawerOpen} category={selectedCategory} onUpdate={handleUpdate} />}
      <InterestDetailDrawer 
        isOpen={isInterestDrawerOpen} 
        onOpenChange={setIsInterestDrawerOpen} 
        details={calculatedInterestDetails} 
      />
    </>
  );
}
