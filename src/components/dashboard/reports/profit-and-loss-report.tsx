'use client';

import { useState, useMemo, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, parseISO, isWithinInterval } from 'date-fns';
import { collection, query, where, orderBy, getDocs, collectionGroup } from 'firebase/firestore';
import { useFirestore, useUser, useCollection } from '@/firebase';
import { formatCurrency } from '@/lib/format';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlayCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Helper: normalize Firestore Timestamp OR string to JS Date (or null)
function toDate(value: any): Date | null {
  if (!value) return null;
  // Firestore Timestamp
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    return value.toDate();
  }
  // ISO date string
  if (typeof value === 'string') {
    const d = parseISO(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}


export function ProfitAndLossReport() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [dates, setDates] = useState<{ from: string, to: string } | null>(null);
  const [activeRange, setActiveRange] = useState<{ from: string, to: string } | null>(null);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // This runs only on the client, after the initial render
    const initialDates = {
      from: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
      to: format(endOfMonth(new Date()), 'yyyy-MM-dd')
    };
    setDates(initialDates);
    setActiveRange(initialDates);
  }, []);
  
  useEffect(() => {
    if (!user || !firestore) return;
    setIsLoading(true);

    const fetchAllData = async () => {
        try {
            const accountsQuery = query(collection(firestore, `users/${user.uid}/bankAccounts`));
            const accountsSnap = await getDocs(accountsQuery);
            if (accountsSnap.empty) {
                setAllTransactions([]);
                setIsLoading(false);
                return;
            }

            const transactionPromises = accountsSnap.docs.map(accountDoc => {
                const transactionsColRef = collection(accountDoc.ref, 'transactions');
                return getDocs(transactionsColRef);
            });

            const transactionSnapshots = await Promise.all(transactionPromises);
            const fetchedTransactions = transactionSnapshots.flatMap(snap => snap.docs.map(d => d.data()));
            
            setAllTransactions(fetchedTransactions);

        } catch (e: any) {
            console.error(e);
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    };
    fetchAllData();
  }, [user, firestore]);

  const reportData = useMemo(() => {
    const empty = { income: [], expenses: [], totalInc: 0, totalExp: 0, net: 0 };
    if (!allTransactions || !activeRange) return empty;

    const fromD = parseISO(activeRange.from);
    const toD = parseISO(activeRange.to);

    const incMap = new Map<string, number>();
    const expMap = new Map<string, number>();
    let totalInc = 0;
    let totalExp = 0;
    
    const userTransactions = allTransactions.filter(tx => tx.userId === user?.uid);

    userTransactions.forEach((tx: any) => {
        const d = toDate(tx.date);
        if (!d || !isWithinInterval(d, { start: fromD, end: toD })) return;
        
        const rawAmount = Number(tx.amount) || 0;
        const isIncome = rawAmount > 0;
        const isExpense = rawAmount < 0;

        const h = tx.categoryHierarchy || {};
        const label = (h.l2 || tx.subcategory || 'Uncategorized').trim();

        const amountAbs = Math.abs(rawAmount);

        if (isIncome) {
            totalInc += amountAbs;
            incMap.set(label, (incMap.get(label) || 0) + amountAbs);
        } else if (isExpense) {
            totalExp += amountAbs;
            expMap.set(label, (expMap.get(label) || 0) + amountAbs);
        }
    });

    return {
      income: Array.from(incMap, ([name, total]) => ({ name, total })).sort((a,b) => b.total - a.total),
      expenses: Array.from(expMap, ([name, total]) => ({ name, total })).sort((a,b) => b.total - a.total),
      totalInc,
      totalExp,
      net: totalInc - totalExp
    };
  }, [allTransactions, user, activeRange]);
  
  if (error) {
    return (
        <Alert variant="destructive" className="m-8">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Firestore Error</AlertTitle>
            <AlertDescription>
                <code className="mt-2 block text-xs font-mono">{error}</code>
            </AlertDescription>
        </Alert>
    );
  }

  return (
    <div className="p-8 space-y-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-end bg-muted/50 p-6 rounded-xl border">
        <div className="flex gap-4">
          <div className="grid gap-2">
            <Label>Start Date</Label>
            <Input type="date" value={dates?.from} onChange={e => setDates(d => ({...d!, from: e.target.value}))} />
          </div>
          <div className="grid gap-2">
            <Label>End Date</Label>
            <Input type="date" value={dates?.to} onChange={e => setDates(d => ({...d!, to: e.target.value}))} />
          </div>
        </div>
        <Button onClick={() => setActiveRange({...dates!})} disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
          Run Report
        </Button>
      </div>

      <Card className="shadow-lg border-t-4 border-t-primary">
        <CardHeader className="border-b bg-slate-50/50 text-center">
          <CardTitle className="text-3xl font-bold">Profit & Loss Statement</CardTitle>
          <CardDescription className="font-mono text-sm uppercase tracking-widest">
             {activeRange ? `${activeRange.from} TO ${activeRange.to}` : "Select a date range"}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
           <div className="text-xs text-muted-foreground text-center mb-4 font-mono">
             Auth UID: {user?.uid} • Loaded: {allTransactions.length} total tx
           </div>
          {isLoading ? (
             <div className="flex flex-col items-center justify-center p-12 space-y-4">
               <Loader2 className="h-8 w-8 animate-spin text-primary" />
               <p className="text-sm text-muted-foreground italic">Fetching ledger data...</p>
             </div>
          ) : (
            <Table>
              <TableBody>
                {/* INCOME SECTION */}
                <TableRow className="bg-green-50 font-bold border-b-2 border-green-200">
                  <TableCell className="text-green-800 text-lg">TOTAL INCOME</TableCell>
                  <TableCell className="text-right text-green-800 text-lg">{formatCurrency(reportData.totalInc)}</TableCell>
                </TableRow>
                {reportData.income.length > 0 ? reportData.income.map(i => (
                  <TableRow key={i.name} className="border-none">
                    <TableCell className="pl-12 text-muted-foreground">{i.name}</TableCell>
                    <TableCell className="text-right">{formatCurrency(i.total)}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={2} className="text-center py-4 text-xs italic text-muted-foreground">No income transactions found.</TableCell></TableRow>
                )}
                
                <TableRow className="h-8"><TableCell colSpan={2}/></TableRow>

                {/* EXPENSE SECTION */}
                <TableRow className="bg-red-50 font-bold border-b-2 border-red-200">
                  <TableCell className="text-red-800 text-lg">TOTAL EXPENSES</TableCell>
                  <TableCell className="text-right text-red-800 text-lg">({formatCurrency(reportData.totalExp)})</TableCell>
                </TableRow>
                {reportData.expenses.length > 0 ? reportData.expenses.map(e => (
                  <TableRow key={e.name} className="border-none">
                    <TableCell className="pl-12 text-muted-foreground">{e.name}</TableCell>
                    <TableCell className="text-right">{formatCurrency(e.total)}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={2} className="text-center py-4 text-xs italic text-muted-foreground">No expense transactions found.</TableCell></TableRow>
                )}
                
                <TableRow className="border-t-4 border-double font-black text-2xl bg-slate-50">
                  <TableCell>NET OPERATING INCOME</TableCell>
                  <TableCell className={`text-right ${reportData.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(reportData.net)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}