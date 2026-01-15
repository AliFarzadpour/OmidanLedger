
'use client';

import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
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
  const { user } = useUser();
  const firestore = useFirestore();
  const [paymentSettings, setPaymentSettings] = useState<NormalizedSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);

  const tenantDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  
  const { data: tenantData, isLoading: isLoadingTenant } = useDoc(tenantDocRef);

  const propertyDocRef = useMemoFirebase(() => {
    if (!firestore || !tenantData?.associatedPropertyId) return null;
    return doc(firestore, 'properties', tenantData.associatedPropertyId);
  }, [firestore, tenantData]);

  const { data: propertyData, isLoading: isLoadingProperty } = useDoc(propertyDocRef);

  useEffect(() => {
    async function fetchSettings() {
      if (!user || !tenantData?.associatedPropertyId) return;
      setLoadingSettings(true);
      try {
        const settings = await getPaymentSettings(tenantData.landlordId, tenantData.associatedPropertyId);
        setPaymentSettings(settings);
      } catch (error) {
        console.error("Failed to fetch payment settings:", error);
      } finally {
        setLoadingSettings(false);
      }
    }

    if (tenantData) {
      fetchSettings();
    }
  }, [tenantData, user]);

  const isLoading = isLoadingTenant || loadingSettings || isLoadingProperty;
  
  const leaseInfo = useMemo(() => {
    if (!propertyData || !tenantData?.email) {
        return { rentAmount: 0, balance: tenantData?.billing?.balance || 0 };
    }
    const tenantInProp = propertyData.tenants?.find((t: any) => t.email === tenantData.email);
    return {
        rentAmount: tenantInProp?.rentAmount || 0,
        balance: tenantData?.billing?.balance || 0,
    };
  }, [propertyData, tenantData]);
  
  const isOverdue = leaseInfo.balance > 0;

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
        <h1 className="text-2xl font-bold">Welcome Home, {tenantData?.name || tenantData?.email?.split('@')[0]}</h1>
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
              ${(leaseInfo.balance || 0).toLocaleString()}
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
        {user && leaseInfo.balance > 0 && (
          <div className="space-y-4">
            {paymentSettings?.stripeEnabled && (
              <PayRentButton amount={leaseInfo.balance} tenantId={user.uid} />
            )}
             {paymentSettings?.zelleEnabled && tenantData && (
                <RecordPaymentModal
                    tenant={{ id: user.uid, firstName: tenantData.name || user.email }}
                    propertyId={tenantData.associatedPropertyId}
                    landlordId={tenantData.landlordId}
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
                {user && tenantData && (
                    <ContactLandlordDialog 
                        userId={user.uid} 
                        landlordId={tenantData.landlordId} 
                        propertyId={tenantData.associatedPropertyId}
                        unitId={tenantData.associatedUnitId}
                        tenantName={tenantData.name || user.email || 'Tenant'}
                        tenantEmail={user.email!}
                    />
                )}
            </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <TenantPaymentHistory />
    </div>
  );
}
