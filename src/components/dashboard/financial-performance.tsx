
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore, useUser } from '@/firebase';
import { doc, collectionGroup, query, where, getDocs } from 'firebase/firestore';
import { useDoc } from '@/firebase/firestore/use-doc';
import { ArrowUpRight, ArrowDownRight, DollarSign, RefreshCw, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { recalculateAllStats } from '@/actions/update-property-stats';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect, useMemo } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

export function FinancialPerformance({ propertyId }: { propertyId?: string }) {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // State for Global Stats (when no propertyId is passed)
  const [globalStats, setGlobalStats] = useState<{ income: number, expenses: number, netIncome: number } | null>(null);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null); // New state for the error message

  const currentMonthKey = format(new Date(), 'yyyy-MM');

  const docRef = useMemo(() => {
    if (!db || !propertyId) return null;
    return doc(db, `properties/${propertyId}/monthlyStats/${currentMonthKey}`);
  }, [db, propertyId, currentMonthKey]);

  // A. SINGLE PROPERTY MODE
  const { data: singleStats, isLoading: singleLoading } = useDoc(docRef);

  // B. GLOBAL PORTFOLIO MODE
  useEffect(() => {
    if (propertyId || !user || !db) return; 

    const fetchGlobalStats = async () => {
        setGlobalLoading(true);
        setErrorMessage(null); // Clear previous errors
        try {
            const q = query(
                collectionGroup(db, 'monthlyStats'),
                where('userId', '==', user.uid),
                where('month', '==', currentMonthKey)
            );
            
            const snapshot = await getDocs(q);
            
            let inc = 0, exp = 0, net = 0;
            snapshot.forEach(doc => {
                const d = doc.data();
                inc += d.income || 0;
                exp += d.expenses || 0;
                net += d.netIncome || 0;
            });

            setGlobalStats({ income: inc, expenses: exp, netIncome: net });
        } catch (error: any) {
            console.error("Failed to fetch portfolio stats:", error);
            setErrorMessage(error.message); // Store the full error message
            if (error.code === 'failed-precondition') {
                toast({
                    variant: 'destructive',
                    title: 'Database Index Required',
                    description: 'A database index is needed for portfolio view. The full error is shown on screen.',
                });
            }
        } finally {
            setGlobalLoading(false);
        }
    };

    fetchGlobalStats();
  }, [propertyId, user, currentMonthKey, db, isRefreshing, toast]); 

  // Determine view mode
  const stats = propertyId ? singleStats : globalStats;
  const loading = propertyId ? singleLoading : globalLoading;

  const handleRecalculate = async () => {
    if(!user) return;
    setIsRefreshing(true);
    try {
        const res = await recalculateAllStats(user.uid);
        toast({ title: "Financials Updated", description: `Scanned and updated ${res.count} monthly records.` });
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
      {errorMessage && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Firestore Query Error</AlertTitle>
          <AlertDescription className="break-all font-mono text-xs">
            {errorMessage}
          </AlertDescription>
        </Alert>
      )}
      <Card className="col-span-4 shadow-sm border-blue-100 mb-6">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="space-y-1">
              <CardTitle className="text-lg font-medium">
                  {propertyId ? "Financial Performance" : "Portfolio Performance"}
              </CardTitle>
              <p className="text-xs text-muted-foreground">Live data for {format(new Date(), 'MMMM yyyy')}</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRecalculate} disabled={isRefreshing} className="gap-2">
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? "Calculating..." : "Recalculate"}
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
              <div className="flex justify-center py-6"><Loader2 className="animate-spin text-muted-foreground" /></div>
          ) : (
              <div className="grid gap-4 md:grid-cols-3">
              
              {/* INCOME */}
              <div className="p-4 border rounded-lg bg-green-50/40 border-green-100">
                  <div className="flex items-center gap-2 text-sm font-medium text-green-800">
                  <ArrowUpRight className="h-4 w-4" /> Total Income
                  </div>
                  <div className="mt-2 text-2xl font-bold text-green-700">
                  {stats ? fmt(stats.income) : '$0.00'}
                  </div>
              </div>

              {/* EXPENSES */}
              <div className="p-4 border rounded-lg bg-red-50/40 border-red-100">
                  <div className="flex items-center gap-2 text-sm font-medium text-red-800">
                  <ArrowDownRight className="h-4 w-4" /> Total Expenses
                  </div>
                  <div className="mt-2 text-2xl font-bold text-red-700">
                  {stats ? fmt(stats.expenses) : '$0.00'}
                  </div>
              </div>

              {/* NET INCOME */}
              <div className="p-4 border rounded-lg bg-blue-50/40 border-blue-100">
                  <div className="flex items-center gap-2 text-sm font-medium text-blue-800">
                  <DollarSign className="h-4 w-4" /> Net Income
                  </div>
                  <div className={`mt-2 text-2xl font-bold ${stats && stats.netIncome >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                  {stats ? fmt(stats.netIncome) : '$0.00'}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                      {stats && stats.income > 0 
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
