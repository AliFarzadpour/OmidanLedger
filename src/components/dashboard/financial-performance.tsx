'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useFirestore, useUser } from '@/firebase';
import { collectionGroup, query, where, getDocs, collection, Timestamp } from 'firebase/firestore';
import { ArrowUpRight, ArrowDownRight, DollarSign, RefreshCw, Loader2, Users, TrendingUp, AlertTriangle } from 'lucide-react';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
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
    const cleaned = v.replace(/[^0-9.-]/g, ""); // strips $ and commas safely
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const toDateSafe = (v: any): Date | null => {
  if (!v) return null;

  // Firestore Timestamp
  if (v instanceof Timestamp) return v.toDate();
  if (typeof v === "object" && typeof v.seconds === "number") {
    return new Date(v.seconds * 1000);
  }

  // String or Date
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

const getRentForDate = (rentHistory: { amount: any; effectiveDate: any }[], date: Date): number => {
  if (!rentHistory || rentHistory.length === 0) return 0;

  // Accept multiple possible keys from DB/UI
  const normalized = rentHistory
    .map((r) => ({
      amount: toNum(r?.amount ?? r?.rent ?? r?.value),
      effective: toDateSafe(r?.effectiveDate ?? r?.date ?? r?.startDate ?? r?.from),
    }))
    .filter((x) => x.amount > 0 && x.effective);

  if (normalized.length === 0) return 0;

  // Sort newest effective date first
  normalized.sort((a, b) => (b.effective!.getTime() - a.effective!.getTime()));

  // Find most recent rent <= target date
  const match = normalized.find((r) => r.effective!.getTime() <= date.getTime());
  return match ? match.amount : 0;
};


function getRentForMonthFromPropertyTenants(tenants: any[] | undefined, date: Date): number {
  if (!tenants || tenants.length === 0) return 0;

  // flatten all rentHistory across all tenants (property-level fallback)
  const allHistory = tenants.flatMap(t => Array.isArray(t?.rentHistory) ? t.rentHistory : []);
  return getRentForDate(allHistory, date);
}

function resolveRentDueForMonth(opts: { monthTenant?: any; property?: any; unit?: any; date: Date }): number {
  const { monthTenant, property, unit, date } = opts;

  // 1) rentHistory on the actual month tenant
  const direct = getRentForDate(monthTenant?.rentHistory || [], date);
  if (direct > 0) return direct;

  // 2) fallback: property-level rent history across ALL tenants
  const propFallback = getRentForMonthFromPropertyTenants(property?.tenants, date);
  if (propFallback > 0) return propFallback;

  // 3) fallbacks: tenant legacy fields
  const tenantRent = toNum(monthTenant?.rentAmount) || toNum(monthTenant?.rent) || toNum(monthTenant?.monthlyRent);
  if (tenantRent > 0) return tenantRent;

  // 4) unit fallbacks (multi-family)
  const unitRent = toNum(unit?.financials?.rent) || toNum(unit?.financials?.targetRent) || toNum(unit?.targetRent);
  if (unitRent > 0) return unitRent;

  // 5) property fallbacks
  const propRent = toNum(property?.financials?.targetRent) || toNum(property?.financials?.rent) || toNum(property?.targetRent);
  if (propRent > 0) return propRent;

  return 0;
}


function monthWindow(date: Date): { start: Date; end: Date } {
  return { start: startOfMonth(date), end: endOfMonth(date) };
}

function tenantForMonth(tenants: any[] | undefined, date: Date): any | null {
  if (!tenants || tenants.length === 0) return null;

  const { start: monthStart, end: monthEnd } = monthWindow(date);

  const overlappingTenants = tenants.filter(t => {
    const leaseStart = toDateSafe(t.leaseStart);
    const leaseEnd = toDateSafe(t.leaseEnd);

    if (!leaseStart || !leaseEnd) return false;

    // Overlap condition: (StartA <= EndB) and (EndA >= StartB)
    return leaseStart <= monthEnd && leaseEnd >= monthStart;
  });

  if (overlappingTenants.length > 1) {
    return overlappingTenants.sort((a, b) => {
      const startA = toDateSafe(a.leaseStart)?.getTime() || 0;
      const startB = toDateSafe(b.leaseStart)?.getTime() || 0;
      return startB - startA; // Sort descending by start date, newest lease wins
    })[0];
  }

  return overlappingTenants[0] || null;
}


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
    
    const propertyMap = new Map((properties || []).map(p => [p.id, p]));

    // Single-family properties
    (properties || [])
      .filter(p => p.type === 'single-family' || p.type === 'condo')
      .forEach(p => {
        const monthTenant = tenantForMonth(p.tenants, viewingDate);
        if (monthTenant) {
            potentialRent += resolveRentDueForMonth({ monthTenant, property: p, date: viewingDate });
        }
    });

    // Multi-family units
    (allUnits || []).forEach(unit => {
        const parentProperty = propertyMap.get(unit.propertyId);
        if (!parentProperty) return;

        const monthTenant = tenantForMonth(unit.tenants, viewingDate);
        if (monthTenant) {
            potentialRent += resolveRentDueForMonth({ monthTenant, property: parentProperty, unit, date: viewingDate });
        }
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
  }, [transactions, properties, allUnits, viewingDate]);


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
