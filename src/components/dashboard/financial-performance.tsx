'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore, useUser } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { ArrowUpRight, ArrowDownRight, DollarSign, RefreshCw, Loader2 } from 'lucide-react';
import { format, startOfYear, endOfYear } from 'date-fns';
import { Button } from '@/components/ui/button';
import { recalculateAllStats } from '@/actions/update-property-stats';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function FinancialPerformance({ propertyId }: { propertyId?: string }) {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // FIX: Default date range to the full current year.
  const currentYearStart = format(startOfYear(new Date()), 'yyyy-MM-dd');
  const currentYearEnd = format(endOfYear(new Date()), 'yyyy-MM-dd');

  const fetchTransactions = useCallback(async () => {
    if (!db || !user) return;
    setIsLoading(true);
    setError(null);
    
    try {
        const bankAccountsSnap = await getDocs(collection(db, `users/${user.uid}/bankAccounts`));
        let allTxs: any[] = [];
        
        for (const accountDoc of bankAccountsSnap.docs) {
            const txsQuery = query(
                collection(db, `users/${user.uid}/bankAccounts/${accountDoc.id}/transactions`),
                where('date', '>=', currentYearStart),
                where('date', '<=', currentYearEnd)
            );
            const txsSnap = await getDocs(txsQuery);
            txsSnap.forEach(txDoc => {
                allTxs.push({ id: txDoc.id, ...txDoc.data() });
            });
        }
        setTransactions(allTxs);

    } catch (e: any) {
        setError(e);
        console.error("Failed to fetch transactions:", e);
    } finally {
        setIsLoading(false);
    }
  }, [db, user, currentYearStart, currentYearEnd]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);


  const stats = useMemo(() => {
    let filteredTxs = transactions;

    // If a propertyId is provided, filter by costCenter.
    if (propertyId) {
      filteredTxs = transactions.filter(tx => tx.costCenter === propertyId);
    }

    let income = 0;
    let expenses = 0;

    filteredTxs.forEach(tx => {
      const amount = Number(tx.amount) || 0;
      const category = tx.categoryHierarchy?.l0 || '';
      
      if (category === 'Income') {
        income += amount;
      } else if (category === 'Expense') {
        expenses += amount; // expenses are negative
      }
    });

    return { income, expenses, netIncome: income + expenses };
  }, [transactions, propertyId]);


  const handleRecalculate = async () => {
    if(!user) return;
    setIsRefreshing(true);
    try {
        const res = await recalculateAllStats(user.uid);
        toast({ title: "Financials Updated", description: `Scanned and updated ${res.count} monthly records.` });
        // After recalculating, refetch the latest data for the current view
        await fetchTransactions();
    } catch(e: any) {
        toast({ variant: 'destructive', title: "Error", description: e.message });
        if (e.message.includes("requires an index")) {
            console.error("INDEX LINK:", e.message);
        }
    } finally {
        setIsRefreshing(false);
    }
  };

  const fmt = (n: number) => Math.abs(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  return (
    <>
      {error && (
        <div className="mb-4 p-4 border border-destructive/50 bg-destructive/10 rounded-lg">
          <h3 className="font-bold text-destructive">Firestore Query Error</h3>
          <p className="text-sm text-destructive/80 mb-2">Please copy the full error message below to create the required index.</p>
          <pre className="bg-white p-3 rounded-md text-xs font-mono whitespace-pre-wrap break-all">
            {error.message}
          </pre>
        </div>
      )}
      <Card className="col-span-4 shadow-sm border-blue-100 mb-6">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="space-y-1">
              <CardTitle className="text-lg font-medium">
                  {propertyId ? "Financial Performance" : "Portfolio Performance"}
              </CardTitle>
              <p className="text-xs text-muted-foreground">Live data for {format(new Date(), 'yyyy')}</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRecalculate} disabled={isRefreshing} className="gap-2">
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? "Calculating..." : "Recalculate All"}
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="animate-spin text-muted-foreground" /></div>
          ) : (
              <div className="grid gap-4 md:grid-cols-3">
              
              {/* INCOME */}
              <div className="p-4 border rounded-lg bg-green-50/40 border-green-100">
                  <div className="flex items-center gap-2 text-sm font-medium text-green-800">
                  <ArrowUpRight className="h-4 w-4" /> Total Income
                  </div>
                  <div className="mt-2 text-2xl font-bold text-green-700">
                  {fmt(stats.income)}
                  </div>
              </div>

              {/* EXPENSES */}
              <div className="p-4 border rounded-lg bg-red-50/40 border-red-100">
                  <div className="flex items-center gap-2 text-sm font-medium text-red-800">
                  <ArrowDownRight className="h-4 w-4" /> Total Expenses
                  </div>
                  <div className="mt-2 text-2xl font-bold text-red-700">
                  {fmt(stats.expenses)}
                  </div>
              </div>

              {/* NET INCOME */}
              <div className="p-4 border rounded-lg bg-blue-50/40 border-blue-100">
                  <div className="flex items-center gap-2 text-sm font-medium text-blue-800">
                  <DollarSign className="h-4 w-4" /> Net Income
                  </div>
                  <div className={`mt-2 text-2xl font-bold ${stats.netIncome >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                  {fmt(stats.netIncome)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                      {stats.income > 0 
                          ? `${Math.round((stats.netIncome / stats.income) * 100)}% Margin` 
                          : '0% Margin'}
                  </p>
              </div>

              </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
