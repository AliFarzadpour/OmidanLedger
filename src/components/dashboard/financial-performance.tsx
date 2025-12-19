'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore, useUser } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useDoc } from '@/firebase/firestore/use-doc';
import { ArrowUpRight, ArrowDownRight, DollarSign, RefreshCw, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { recalculateAllStats } from '@/actions/update-property-stats';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

export function FinancialPerformance({ propertyId }: { propertyId?: string }) {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // 1. Determine Month: Defaults to current month (e.g., "2025-12")
  const currentMonthKey = format(new Date(), 'yyyy-MM');
  
  // 2. Listen to the Real Data
  const docRef = propertyId 
    ? doc(db, `properties/${propertyId}/monthlyStats/${currentMonthKey}`)
    : null; // If no property is passed, we show nothing (or a global summary later)

  const { data: stats, isLoading: loading } = useDoc(docRef);

  // 3. The "Recalculate" Action
  const handleRecalculate = async () => {
    if(!user) return;
    setIsRefreshing(true);
    try {
        const res = await recalculateAllStats(user.uid);
        toast({ title: "Financials Updated", description: `Scanned and updated ${res.count} monthly records.` });
    } catch(e: any) {
        toast({ variant: 'destructive', title: "Error", description: e.message });
        
        // Helpful Tip for Index Errors
        if (e.message.includes("requires an index")) {
            console.error("OPEN THIS LINK TO FIX INDEX:", e.message);
        }
    } finally {
        setIsRefreshing(false);
    }
  };

  // Helper to format currency
  const fmt = (n: number) => Math.abs(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  if (!propertyId) return null; // Don't crash if used outside property context

  return (
    <Card className="col-span-4 shadow-sm border-blue-100 mb-6">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="space-y-1">
            <CardTitle className="text-lg font-medium">Financial Performance</CardTitle>
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
                <ArrowUpRight className="h-4 w-4" /> Income
                </div>
                <div className="mt-2 text-2xl font-bold text-green-700">
                {stats ? fmt(stats.income) : '$0.00'}
                </div>
            </div>

            {/* EXPENSES */}
            <div className="p-4 border rounded-lg bg-red-50/40 border-red-100">
                <div className="flex items-center gap-2 text-sm font-medium text-red-800">
                <ArrowDownRight className="h-4 w-4" /> Expenses
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
  );
}
