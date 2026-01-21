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
import { StatCard } from './stat-card';


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

// Helper function to fetch units in chunks
function chunk<T>(arr: T[], size = 10) {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}
  
async function fetchUnitsForProperties(firestore: any, propertyIds: string[], userId: string) {
    if (propertyIds.length === 0 || !userId) return [];
    const chunks = chunk(propertyIds, 10);
    const all: any[] = [];
  
    for (const ids of chunks) {
      const qUnits = query(
        collectionGroup(firestore, "units"),
        where("userId", "==", userId), // CRITICAL: Security rule compliance
        where("propertyId", "in", ids)
      );
      const snap = await getDocs(qUnits);
      snap.forEach((d) => all.push({ id: d.id, path: d.ref.path, ...d.data() }));
    }
  
    return all;
}

const toNum = (v: any): number => {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const cleaned = v.replace(/[^0-9.-]/g, "", ""); // strips $ and commas safely
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};


export function FinancialPerformance({ viewingDate }: { viewingDate: Date }) {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [allUnits, setAllUnits] = useState<any[]>([]);
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
        
        const propertyIds = allProps.map(p => p.id);
        if (propertyIds.length > 0) {
            const units = await fetchUnitsForProperties(db, propertyIds, user.uid);
            setAllUnits(units);
        }

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
    
    properties.forEach(prop => {
        if (prop.type === 'single-family' || prop.type === 'condo') {
            (prop.tenants || []).forEach((tenant: any) => {
                if (tenant.status === 'active') {
                    potentialRent += toNum(tenant.rentAmount);
                }
            });
        }
    });

    allUnits.forEach(unit => {
        (unit.tenants || []).forEach((tenant: any) => {
            if (tenant.status === 'active') {
                 const rentDue =
                    toNum(tenant.rentAmount) ||
                    toNum(unit.financials?.rent) ||
                    toNum(unit.financials?.targetRent) ||
                    toNum(unit.targetRent) ||
                    0;
                potentialRent += rentDue;
            }
        });
    });
    
    const tenantPayments = new Map<string, number>();

    transactions.forEach(tx => {
      const amount = Number(tx.amount) || 0;
      const l0 = normalizeL0(tx);
      const isRentalIncome = (tx.categoryHierarchy?.l1 || '').toLowerCase().includes('rental income');

      if (l0 === 'INCOME' && isRentalIncome && amount > 0) {
        collectedRent += amount;
        if (tx.tenantId) {
            tenantPayments.set(tx.tenantId, (tenantPayments.get(tx.tenantId) || 0) + amount);
        }
      }
    });

    const economicOccupancy = potentialRent > 0 ? (collectedRent / potentialRent) * 100 : 0;
    const rentCollectionRate = potentialRent > 0 ? (collectedRent / potentialRent) * 100 : 0;
    
    return { 
        economicOccupancy, 
        rentCollectionRate,
        collectedRent,
        potentialRent,
    };
  }, [transactions, properties, allUnits]);


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
  
  const outstandingRent = stats.potentialRent - stats.collectedRent;

  return (
    <>
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Error Fetching KPIs</AlertTitle>
          <pre className="text-xs font-mono whitespace-pre-wrap">{error.message}</pre>
        </Alert>
      )}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <TooltipProvider>
            <StatCard 
                title="Total Rent Due" 
                value={stats.potentialRent}
                icon={<DollarSign className="h-5 w-5 text-muted-foreground"/>}
                isLoading={isLoading}
                cardClassName="bg-blue-50 border-blue-200"
            />
            <StatCard 
                title="Total Rent Collected" 
                value={stats.collectedRent}
                icon={<DollarSign className="h-5 w-5 text-green-500"/>}
                isLoading={isLoading}
                colorClass="text-green-600"
                cardClassName="bg-green-50 border-green-200"
                description={outstandingRent > 0 ? `${formatCurrency(outstandingRent)} outstanding` : ''}
            />
            <Tooltip>
                <TooltipTrigger asChild>
                    <div>
                        <StatCard 
                            title="Rent Collection Rate" 
                            value={stats.rentCollectionRate}
                            format="percent"
                            icon={<TrendingUp className="h-5 w-5 text-muted-foreground"/>}
                            isLoading={isLoading}
                            cardClassName="bg-amber-50 border-amber-200"
                            description={outstandingRent > 0 ? `${(100 - stats.rentCollectionRate).toFixed(1)}% unpaid` : ''}
                        >
                            <Progress value={stats.rentCollectionRate} className="mt-2 h-2" />
                        </StatCard>
                    </div>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Percentage of billed rent collected this period</p>
                </TooltipContent>
            </Tooltip>
             <Tooltip>
                <TooltipTrigger asChild>
                    <div>
                        <StatCard 
                            title="Economic Occupancy" 
                            value={stats.economicOccupancy}
                            format="percent"
                            icon={<Users className="h-5 w-5 text-muted-foreground"/>}
                            isLoading={isLoading}
                            colorClass={getOccupancyColor(stats.economicOccupancy)}
                            cardClassName="bg-indigo-50 border-indigo-200"
                        />
                    </div>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Actual rent collected ÷ potential rent (before concessions)</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
      </div>
    </>
  );
}
