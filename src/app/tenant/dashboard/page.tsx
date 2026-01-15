
'use client';

import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collectionGroup, query, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CreditCard, History, Home, AlertCircle, Wallet, MessageSquare } from 'lucide-react';
import { PayRentButton } from '@/components/tenant/PayRentButton';
import TenantPaymentHistory from '../history/page';
import { useEffect, useState, useMemo } from 'react';
import { getPaymentSettings } from '@/lib/getPaymentSettings';
import { RecordPaymentModal } from '@/components/dashboard/sales/RecordPaymentModal';
import { ContactLandlordDialog } from '@/components/tenant/ContactLandlordDialog';

interface NormalizedSettings {
    stripeEnabled: boolean;
    zelleEnabled: boolean;
    zelleRecipientName: string;
    zelleRecipientHandle: string;
    zelleMemoTemplate: string;
    zelleNotes: string;
}

export default function TenantDashboard() {
  const { user, isUserLoading: isAuthLoading } = useUser();
  const firestore = useFirestore();
  const [paymentSettings, setPaymentSettings] = useState<NormalizedSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);

  // Step 1: Fetch the tenant's profile. This is our source of truth.
  const tenantProfileRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'tenantProfiles', user.uid);
  }, [user, firestore]);
  
  const { data: tenantProfile, isLoading: isLoadingTenant } = useDoc(tenantProfileRef);
  
  // Step 2: Use the IDs from the tenant's profile to fetch the property and unit.
  const propertyDocRef = useMemoFirebase(() => {
    if (!firestore || !tenantProfile?.propertyId) return null;
    return doc(firestore, 'properties', tenantProfile.propertyId);
  }, [firestore, tenantProfile]);

  const unitDocRef = useMemoFirebase(() => {
    if (!firestore || !tenantProfile?.propertyId || !tenantProfile?.unitId) return null;
    return doc(firestore, 'properties', tenantProfile.propertyId, 'units', tenantProfile.unitId);
  }, [firestore, tenantProfile]);
  
  // NEW: Step 3: Fetch the tenant's transaction history from the ledger
  const transactionsQuery = useMemoFirebase(() => {
      if (!user || !firestore) return null;
      // This queries the entire 'transactions' collection group for entries matching the tenant's ID
      return query(collectionGroup(firestore, 'transactions'), where('tenantId', '==', user.uid));
  }, [user, firestore]);

  const { data: propertyData, isLoading: isLoadingProperty } = useDoc(propertyDocRef);
  const { data: unitData, isLoading: isLoadingUnit } = useDoc(unitDocRef);
  const { data: transactions, isLoading: isLoadingTransactions } = useCollection(transactionsQuery);
  
  useEffect(() => {
    async function fetchSettings() {
      if (!user || !tenantProfile?.propertyId || !tenantProfile?.landlordId) return;
      setLoadingSettings(true);
      try {
        const settings = await getPaymentSettings(tenantProfile.landlordId, tenantProfile.propertyId);
        setPaymentSettings(settings);
      } catch (error) {
        console.error("Failed to fetch payment settings:", error);
      } finally {
        setLoadingSettings(false);
      }
    }

    if (tenantProfile) {
      fetchSettings();
    }
  }, [tenantProfile, user]);
  
  const isLoading = isAuthLoading || isLoadingTenant || loadingSettings || isLoadingProperty || isLoadingUnit || isLoadingTransactions;
  
  const leaseInfo = useMemo(() => {
    const tenantEmail = tenantProfile?.email;
    
    // NEW: Calculate balance from the fetched transactions
    const balance = transactions?.reduce((acc, tx) => acc + (tx.amount || 0), 0) ?? 0;
    
    if (!tenantEmail) return { rentAmount: 0, balance };

    const tenantInUnit = unitData?.tenants?.find((t: any) => t.email === tenantEmail);
    const tenantInProp = propertyData?.tenants?.find((t: any) => t.email === tenantEmail);
    
    const rentAmount =
        toNum(tenantInUnit?.rentAmount) ||
        toNum(tenantInProp?.rentAmount) ||
        toNum(unitData?.financials?.rent) ||
        toNum(propertyData?.financials?.rent) ||
        0;

    return { rentAmount, balance };
  }, [tenantProfile, propertyData, unitData, transactions]);

  const toNum = (val: any) => {
    const num = parseFloat(val);
    return isNaN(num) ? 0 : num;
  };
  
  const isOverdue = leaseInfo.balance < 0; // A negative balance means the tenant owes money

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
        <h1 className="text-2xl font-bold">Welcome Home, {tenantProfile?.email?.split('@')[0]}</h1>
        <p className="text-slate-500 text-sm">Manage your rent and residency at {propertyData?.name || 'your home'}.</p>
      </header>

      {/* Main Stats & Payment */}
      <div className="grid gap-6 md:grid-cols-3">
         <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Monthly Rent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-slate-900">
              ${(leaseInfo.rentAmount || 0).toLocaleString()}
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
              ${Math.abs(leaseInfo.balance || 0).toLocaleString()}
            </div>
            {isOverdue && (
              <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Payment is currently due
              </p>
            )}
             {!isOverdue && leaseInfo.balance > 0 && (
                 <p className="text-xs text-green-600 mt-2">You have a credit on your account.</p>
             )}
          </CardContent>
        </Card>
      </div>

       <div className="grid gap-4 md:grid-cols-3">
         <Card className="md:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5"/>How to Pay</CardTitle></CardHeader>
          <CardContent className="space-y-4">
              {paymentSettings?.zelleEnabled && (
                <div className="p-4 bg-slate-100 rounded-md">
                    <h4 className="font-semibold">Pay with Zelle</h4>
                    <p className="text-sm text-muted-foreground mt-1">To pay, send money to: <strong className="font-mono text-primary">{paymentSettings.zelleRecipientHandle || 'Not Provided'}</strong></p>
                    {paymentSettings.zelleNotes && <p className="text-xs text-muted-foreground mt-2">{paymentSettings.zelleNotes}</p>}
                </div>
              )}

              {!paymentSettings?.stripeEnabled && !paymentSettings?.zelleEnabled && (
                  <p className="text-sm text-muted-foreground">Contact your landlord for payment instructions.</p>
              )}
          </CardContent>
        </Card>
        {user && isOverdue && (
          <div className="space-y-4">
            {paymentSettings?.stripeEnabled && (
              <PayRentButton amount={Math.abs(leaseInfo.balance)} tenantId={user.uid} />
            )}
             {paymentSettings?.zelleEnabled && tenantProfile && (
                <RecordPaymentModal
                    tenant={{ id: user.uid, firstName: tenantProfile.email.split('@')[0] }}
                    propertyId={tenantProfile.propertyId}
                    unitId={tenantProfile.unitId}
                    landlordId={tenantProfile.landlordId}
                    buttonText="I've Paid via Zelle/Check"
                />
            )}
          </div>
        )}
      </div>

      <div className="grid gap-4">
        <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5"/>Contact Landlord</CardTitle></CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground mb-4">Submit a maintenance request or ask a question.</p>
                {user && tenantProfile && (
                    <ContactLandlordDialog 
                        userId={user.uid} 
                        landlordId={tenantProfile.landlordId} 
                        propertyId={tenantProfile.propertyId}
                        unitId={tenantProfile.unitId}
                        tenantName={tenantProfile.email.split('@')[0]}
                        tenantEmail={user.email!}
                    />
                )}
            </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <TenantPaymentHistory transactions={transactions || []} isLoading={isLoadingTransactions} />
    </div>
  );
}
