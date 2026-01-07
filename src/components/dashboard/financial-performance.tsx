
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useFirestore, useUser } from '@/firebase';
import { collectionGroup, query, where, getDocs, collection } from 'firebase/firestore';
import { ArrowUpRight, ArrowDownRight, DollarSign, RefreshCw, Loader2, Users, TrendingUp, AlertTriangle } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Button } from '@/components/ui/button';
import { recalculateAllStats } from '@/actions/update-property-stats';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { formatCurrency } from '@/lib/format';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function normalizeL0(tx: any): string {
    const raw = String(tx?.categoryHierarchy?.l0 || tx?.primaryCategory || '').toUpperCase();
    if (raw === 'INCOME') return 'INCOME';
    if (raw === 'OPERATING EXPENSE') return 'OPERATING EXPENSE';
    if (raw === 'EXPENSE') return 'EXPENSE';
    if (raw === 'ASSET') return 'ASSET';
    if (raw === 'LIABILITY') return 'LIABILITY';
    if (raw === 'EQUITY') return 'EQUITY';
    if (raw.includes('INCOME')) return 'INCOME';
    if (raw.includes('EXPENSE')) return 'OPERATING EXPENSE';
    return 'OPERATING EXPENSE';
}

function KPICard({ title, value, icon, tooltip, colorClass, children }: { title: string, value: string, icon: React.ReactNode, tooltip: string, colorClass?: string, children?: React.ReactNode }) {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Card className="shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                            {icon}
                        </CardHeader>
                        <CardContent>
                            <div className={`text-2xl font-bold ${colorClass || ''}`}>{value}</div>
                            {children}
                        </CardContent>
                    </Card>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{tooltip}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}


export function FinancialPerformance({ viewingDate }: { viewingDate: Date }) {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const currentMonthStart = useMemo(() => format(startOfMonth(viewingDate), 'yyyy-MM-dd'), [viewingDate]);
  const currentMonthEnd = useMemo(() => format(endOfMonth(viewingDate), 'yyyy-MM-dd'), [viewingDate]);

  const fetchData = useCallback(async () => {
    if (!db || !user) return;
    setIsLoading(true);
    setError(null);
    
    try {
        const [txsSnap, propsSnap] = await Promise.all([
             getDocs(query(
                collectionGroup(db, 'transactions'),
                where('userId', '==', user.uid),
                where('date', '>=', currentMonthStart),
                where('date', '<=', currentMonthEnd)
            )),
             getDocs(query(
                collection(db, 'properties'),
                where('userId', '==', user.uid)
            ))
        ]);

        const allTxs = txsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setTransactions(allTxs);

        const allProps = propsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setProperties(allProps);

    } catch (e: any) {
        setError(e);
        console.error("Failed to fetch financial performance data:", e);
    } finally {
        setIsLoading(false);
    }
  }, [db, user, currentMonthStart, currentMonthEnd]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);


  const stats = useMemo(() => {
    let collectedRent = 0;
    let potentialRent = 0;
    let rentByTenant: { [key: string]: number } = {};

    properties.forEach(prop => {
        if(prop.tenants) {
            prop.tenants.forEach((tenant: any) => {
                if(tenant.status === 'active') {
                    potentialRent += Number(tenant.rentAmount || 0);
                }
            })
        }
    });
    
    transactions.forEach(tx => {
      const amount = Number(tx.amount) || 0;
      const l0 = normalizeL0(tx);
      const isRentalIncome = (tx.categoryHierarchy?.l1 || '').toLowerCase().includes('rental income');

      if (l0 === 'INCOME' && isRentalIncome) {
        collectedRent += amount;
        const tenantId = tx.tenantId || 'unknown';
        rentByTenant[tenantId] = (rentByTenant[tenantId] || 0) + amount;
      }
    });
    
    const economicOccupancy = potentialRent > 0 ? (collectedRent / potentialRent) * 100 : 0;
    const rentCollectionRate = potentialRent > 0 ? (collectedRent / potentialRent) * 100 : 0;
    
    let largestTenantRent = 0;
    if (Object.keys(rentByTenant).length > 0) {
        largestTenantRent = Math.max(...Object.values(rentByTenant));
    }
    const rentConcentration = collectedRent > 0 ? (largestTenantRent / collectedRent) * 100 : 0;


    return { 
        economicOccupancy, 
        rentCollectionRate,
        rentConcentration,
        collectedRent,
        potentialRent,
    };
  }, [transactions, properties]);


  const handleRecalculate = async () => {
    if(!user) return;
    setIsRefreshing(true);
    try {
        const res = await recalculateAllStats(user.uid);
        toast({ title: "Financials Updated", description: `Scanned and updated ${res.count} monthly records.` });
        await fetchData();
    } catch(e: any) {
        toast({ variant: 'destructive', title: "Error", description: e.message });
    } finally {
        setIsRefreshing(false);
    }
  };

  const getOccupancyColor = (rate: number) => {
      if (rate > 95) return 'text-green-600';
      if (rate > 85) return 'text-amber-600';
      return 'text-red-600';
  }

  return (
    <>
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Error Fetching KPIs</AlertTitle>
          <pre className="text-xs font-mono whitespace-pre-wrap">{error.message}</pre>
        </Alert>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <KPICard 
            title="Economic Occupancy" 
            value={`${stats.economicOccupancy.toFixed(1)}%`}
            icon={<Users className="h-5 w-5 text-muted-foreground"/>}
            tooltip="Collected Rent ÷ Potential Rent for all active leases."
            colorClass={getOccupancyColor(stats.economicOccupancy)}
        />
        <KPICard 
            title="Rent Collection Rate" 
            value={`${stats.rentCollectionRate.toFixed(1)}%`}
            icon={<TrendingUp className="h-5 w-5 text-muted-foreground"/>}
            tooltip="Collected rent vs. Billed rent for the current period."
        >
            <Progress value={stats.rentCollectionRate} className="mt-2 h-2" />
        </KPICard>
        <KPICard 
            title="Rent Concentration" 
            value={`${stats.rentConcentration.toFixed(1)}%`}
            icon={stats.rentConcentration > 30 ? <AlertTriangle className="h-5 w-5 text-red-500" /> : <Users className="h-5 w-5 text-muted-foreground"/>}
            tooltip="Percentage of total collected rent coming from the largest single tenant."
            colorClass={stats.rentConcentration > 30 ? 'text-red-600' : ''}
        >
             <p className="text-xs text-muted-foreground mt-1">
                Largest tenant paid {formatCurrency(Object.values(stats).reduce((max, v) => Math.max(max, v), 0))}
            </p>
        </KPICard>
      </div>
    </>
  );
}
