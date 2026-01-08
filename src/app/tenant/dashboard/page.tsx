'use client';

import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CreditCard, History, Home, AlertCircle, Wallet } from 'lucide-react';
import { PayRentButton } from '@/components/tenant/PayRentButton';
import TenantPaymentHistory from '../history/page';

export default function TenantDashboard() {
  const { user } = useUser();
  const firestore = useFirestore();

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
            <div className="grid gap-4 grid-cols-1">
                <Skeleton className="h-48 w-full" />
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

      {/* Main Stats & Payment */}
      <div className="grid gap-6 md:grid-cols-3">
         <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Monthly Rent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-slate-900">
              ${(billing.rentAmount || 0).toLocaleString()}
            </div>
            <p className="text-xs text-slate-500 mt-2">Due on the 1st of every month</p>
          </CardContent>
        </Card>
        
        <Card className={isOverdue ? "border-red-200 bg-red-50/30" : "border-blue-100"}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Current Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-4xl font-bold ${isOverdue ? 'text-red-600' : 'text-slate-900'}`}>
              ${(billing.balance || 0).toLocaleString()}
            </div>
            {isOverdue && (
              <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Payment is currently due
              </p>
            )}
          </CardContent>
        </Card>
      </div>

       <div className="grid gap-4 md:grid-cols-3">
         <Card className="md:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5"/>How to Pay</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Your landlord accepts payments via Zelle. To pay, send money to:<br/> <strong className="font-mono text-primary">landlord@email.com</strong></p>
            <p className="text-xs text-muted-foreground mt-2">After paying, please report it on the dashboard so your landlord can verify it.</p>
          </CardContent>
        </Card>
        {user && billing.balance > 0 && (
          <PayRentButton amount={billing.balance} tenantId={user.uid} />
        )}
      </div>


      {/* Recent Activity */}
      <TenantPaymentHistory />
    </div>
  );
}
