'use client';

import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CreditCard, History, Home, AlertCircle } from 'lucide-react';

export default function TenantDashboard() {
  const { user } = useUser();
  const firestore = useFirestore();

  // Memoize the document reference to prevent re-renders
  const tenantDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  
  const { data: tenantData, isLoading } = useDoc(tenantDocRef);

  const billing = tenantData?.billing || { balance: 0, rentAmount: 0 };
  const isOverdue = billing.balance > 0;

  if (isLoading) {
    return (
        <div className="space-y-6">
            <header>
                <Skeleton className="h-8 w-1/2 mb-2" />
                <Skeleton className="h-4 w-1/3" />
            </header>
            <div className="grid gap-4 md:grid-cols-2">
                <Card><CardHeader><Skeleton className="h-4 w-1/3" /></CardHeader><CardContent><Skeleton className="h-10 w-1/2" /></CardContent></Card>
                <Card><CardHeader><Skeleton className="h-4 w-1/3" /></CardHeader><CardContent><Skeleton className="h-10 w-1/2" /></CardContent></Card>
            </div>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
            </div>
        </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Welcome Home</h1>
        <p className="text-slate-500 text-sm">Manage your rent and residency</p>
      </header>

      {/* Main Stats Row */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className={isOverdue ? "border-red-200 bg-red-50/30" : "border-blue-100"}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Current Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-4xl font-bold ${isOverdue ? 'text-red-600' : 'text-slate-900'}`}>
              ${billing.balance.toLocaleString()}
            </div>
            {isOverdue && (
              <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Payment is currently due
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Monthly Rent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-slate-900">
              ${billing.rentAmount.toLocaleString()}
            </div>
            <p className="text-xs text-slate-500 mt-2">Due on the 1st of every month</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <Button size="lg" className="h-24 flex flex-col gap-2 bg-blue-600 hover:bg-blue-700">
          <CreditCard className="h-6 w-6" />
          <span>Pay Rent</span>
        </Button>
        
        <Button variant="outline" size="lg" className="h-24 flex flex-col gap-2">
          <History className="h-6 w-6" />
          <span>Payment History</span>
        </Button>

        <Button variant="outline" size="lg" className="h-24 flex flex-col gap-2">
          <Home className="h-6 w-6" />
          <span>Lease Details</span>
        </Button>
      </div>

      {/* Placeholder for Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-slate-500 py-4 text-center border-2 border-dashed rounded-lg">
            No recent payments or charges to show.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
