
'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, ChevronLeft, ChevronRight, Send } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { CreateChargeDialog } from './CreateChargeDialog';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, isSameMonth, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { getDocs, collection, query, limit, where, doc, collectionGroup } from 'firebase/firestore';
import { batchCreateTenantInvoices } from '@/actions/batch-invoice-actions';
import { useToast } from '@/hooks/use-toast';


interface Tenant {
    id?: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    status: 'active' | 'past';
    rentAmount: number;
}

interface Unit {
    id: string;
    unitNumber: string;
    tenants: Tenant[];
    financials?: {
        rent: number;
    };
    propertyId: string; // Ensure this exists for linking back
}

interface Property {
    id: string;
    name: string;
    address: {
        street: string;
    };
    isMultiUnit?: boolean;
    tenants: Tenant[];
}

type Tx = any;

export function RentRollTable() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [viewingDate, setViewingDate] = useState(new Date());
  const [isBatching, setIsBatching] = useState(false);
  
  const [monthlyIncomeTx, setMonthlyIncomeTx] = useState<Tx[]>([]);
  const [isLoadingTx, setIsLoadingTx] = useState(false);
  const [txError, setTxError] = useState<any>(null);

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: landlordUserDoc } = useDoc(userDocRef);
  const landlordStripeId = landlordUserDoc?.stripeAccountId;

  const { startOfMonth: startOfMonthDate, endOfMonth: endOfMonthDate } = useMemo(() => {
    return {
      startOfMonth: startOfMonth(viewingDate),
      endOfMonth: endOfMonth(viewingDate),
    }
  }, [viewingDate]);

  const monthStartStr = useMemo(() => format(startOfMonthDate, 'yyyy-MM-dd'), [startOfMonthDate]);
  const monthEndStr = useMemo(() => format(endOfMonthDate, 'yyyy-MM-dd'), [endOfMonthDate]);
  
  useEffect(() => {
    (async () => {
      if (!firestore || !user?.uid) return;
  
      setIsLoadingTx(true);
      setTxError(null);
  
      try {
        const baSnap = await getDocs(
          query(
            collection(firestore, 'users', user.uid, 'bankAccounts')
          )
        );

        const bankAccountIds = baSnap.docs.map(d => d.id);
        const allTx: Tx[] = [];
  
        for (const bankId of bankAccountIds) {
          const txRef = collection(
            firestore,
            'users',
            user.uid,
            'bankAccounts',
            bankId,
            'transactions'
          );
  
          const txSnap = await getDocs(
            query(
              txRef,
              where('categoryHierarchy.l0', '==', 'INCOME'),
              where('date', '>=', monthStartStr),
              where('date', '<=', monthEndStr)
            )
          );
  
          txSnap.docs.forEach(doc => {
            allTx.push({ id: doc.id, ...doc.data() });
          });
        }
  
        setMonthlyIncomeTx(allTx);

      } catch (e) {
        console.error('Monthly tx fetch failed:', e);
        setTxError(e);
        setMonthlyIncomeTx([]);
      } finally {
        setIsLoadingTx(false);
      }
    })();
  }, [firestore, user?.uid, monthStartStr, monthEndStr]);

  const propertiesQuery = useMemoFirebase(() => {
    if (!user?.uid || !firestore) return null;
    return query(collection(firestore, 'properties'), where('userId', '==', user.uid));
  }, [user?.uid, firestore]);
  
  const { data: properties, isLoading: isLoadingProperties } = useCollection<Property>(propertiesQuery);

  const unitsQuery = useMemoFirebase(() => {
    if (!user?.uid || !firestore) return null;
    return query(collectionGroup(firestore, 'units'), where('userId', '==', user.uid));
  }, [user?.uid, firestore]);
  const { data: allUnits } = useCollection<Unit>(unitsQuery);

  const unitsByPropertyId = useMemo(() => {
    if (!allUnits) return {};
    return allUnits.reduce((acc, unit) => {
      const propertyId = unit.propertyId; // Use the stored propertyId field
      if (!acc[propertyId]) acc[propertyId] = [];
      acc[propertyId].push(unit);
      return acc;
    }, {} as Record<string, Unit[]>);
  }, [allUnits]);

  const incomeByPropertyOrUnit = useMemo(() => {
    const map: Record<string, number> = {};
    for (const tx of monthlyIncomeTx) {
      const id = String(tx.unitId || tx.propertyId || tx.costCenter || '').trim();
      if (!id) continue;
  
      const amt = typeof tx.amount === 'number' ? tx.amount : Number(tx.amount || 0);
      if (!Number.isFinite(amt) || amt <= 0) continue;
  
      map[id] = (map[id] || 0) + amt;
    }
    return map;
  }, [monthlyIncomeTx]);


  const rentRoll = useMemo(() => {
    if (!properties) return [];

    return properties.flatMap(p => {
        if (p.isMultiUnit) {
            const propertyUnits = unitsByPropertyId[p.id] || [];
            return propertyUnits.map(unit => {
                const activeTenant = unit.tenants?.find(t => t.status === 'active');
                if (!activeTenant) return undefined;
                
                const tenantIdentifier = activeTenant.id || activeTenant.email;
                const rentDue = activeTenant.rentAmount || unit.financials?.rent || 0;
                const amountPaid = incomeByPropertyOrUnit[unit.id] || 0; // Match by unit ID
                const balance = rentDue - amountPaid;

                let status: 'unpaid' | 'paid' | 'partial' | 'overpaid' = 'unpaid';
                if (amountPaid === 0 && rentDue > 0) status = 'unpaid';
                else if (amountPaid >= rentDue) status = 'paid';
                else if (amountPaid > 0) status = 'partial';
                
                if (amountPaid > rentDue && rentDue > 0) status = 'overpaid';

                return {
                    propertyId: p.id,
                    unitId: unit.id,
                    propertyName: `${p.name} #${unit.unitNumber}`,
                    tenantId: tenantIdentifier,
                    tenantName: `${activeTenant.firstName} ${activeTenant.lastName}`,
                    tenantEmail: activeTenant.email,
                    tenantPhone: activeTenant.phone,
                    rentAmount: rentDue,
                    amountPaid: amountPaid,
                    balance: balance,
                    status: status
                };
            }).filter(Boolean);
        } else {
            // Single-family logic
            const activeTenant = p.tenants?.find(t => t.status === 'active');
            if (!activeTenant) return [];

            const tenantIdentifier = activeTenant.id || activeTenant.email;
            const rentDue = activeTenant.rentAmount || 0;
            const amountPaid = incomeByPropertyOrUnit[p.id] || 0; // Match by property ID
            const balance = rentDue - amountPaid;

            let status: 'unpaid' | 'paid' | 'partial' | 'overpaid' = 'unpaid';
            if (amountPaid === 0 && rentDue > 0) status = 'unpaid';
            else if (amountPaid >= rentDue) status = 'paid';
            else if (amountPaid > 0) status = 'partial';
            
            if (amountPaid > rentDue && rentDue > 0) status = 'overpaid';

            return [{
                propertyId: p.id,
                propertyName: p.name,
                tenantId: tenantIdentifier,
                tenantName: `${activeTenant.firstName} ${activeTenant.lastName}`,
                tenantEmail: activeTenant.email,
                tenantPhone: activeTenant.phone,
                rentAmount: rentDue,
                amountPaid: amountPaid,
                balance: balance,
                status: status
            }];
        }
    }).filter(item => item && item.rentAmount > 0);
  }, [properties, unitsByPropertyId, incomeByPropertyOrUnit]);
  
  const unpaidTenants = useMemo(() => {
    return rentRoll.filter(item => item?.status === 'unpaid' || item?.status === 'partial');
  }, [rentRoll]);
  
  const handleBatchSend = async () => {
    if (!landlordStripeId) {
      toast({
        variant: 'destructive',
        title: 'Stripe Not Connected',
        description: 'Please connect your Stripe account in Settings to send invoices.',
      });
      return;
    }
    if (unpaidTenants.length === 0) {
      toast({ title: 'All Caught Up!', description: 'No outstanding invoices to send.' });
      return;
    }

    setIsBatching(true);
    const invoicesToSend = unpaidTenants.map(tenant => ({
      landlordAccountId: landlordStripeId,
      tenantEmail: tenant!.tenantEmail,
      tenantPhone: tenant!.tenantPhone,
      amount: tenant!.balance > 0 ? tenant!.balance : tenant!.rentAmount,
      description: `Rent for ${format(viewingDate, 'MMMM yyyy')}`,
    }));

    try {
      const result = await batchCreateTenantInvoices(invoicesToSend);
      toast({
        title: 'Batch Invoicing Complete',
        description: `${result.success} invoices sent successfully. ${result.failed} failed.`,
      });
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Batch Send Failed',
        description: e.message || 'An unexpected error occurred.',
      });
    } finally {
      setIsBatching(false);
    }
  };

  const isLoading = isLoadingProperties || isLoadingTx;

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
            <div>
                <CardTitle>Rent Roll</CardTitle>
                <CardDescription>
                    Payment status for the billing period of {format(viewingDate, 'MMMM yyyy')}.
                </CardDescription>
            </div>
            <div className="flex items-center gap-2">
                <Button 
                    variant="outline"
                    onClick={handleBatchSend}
                    disabled={isLoading || isBatching || unpaidTenants.length === 0}
                >
                    {isBatching ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Send className="mr-2 h-4 w-4" />
                    )}
                    Send Invoices ({unpaidTenants.length})
                </Button>
                <Button variant="outline" size="icon" onClick={() => setViewingDate(d => subMonths(d, 1))}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => setViewingDate(d => addMonths(d, 1))}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Property</TableHead>
              <TableHead>Tenant</TableHead>
              <TableHead>Rent Due</TableHead>
              <TableHead>Amount Paid</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                <TableRow>
                    <TableCell colSpan={6} className="text-center p-8">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground"/>
                    </TableCell>
                </TableRow>
            ) : rentRoll.length === 0 ? (
                 <TableRow>
                    <TableCell colSpan={6} className="text-center p-8">
                        <p className="font-semibold">No Active Leases with Rent Due Found</p>
                        <p className="text-sm text-muted-foreground">Add tenants with rent amounts to your properties to see them here.</p>
                    </TableCell>
                </TableRow>
            ) : (
                rentRoll.map((item) => (
                  item &&
              <TableRow key={item.propertyId + (item.tenantId || '')}>
                <TableCell className="font-medium">{item.propertyName}</TableCell>
                <TableCell>{item.tenantName}</TableCell>
                <TableCell>{formatCurrency(item.rentAmount)}</TableCell>
                <TableCell className="font-medium text-green-700">{formatCurrency(item.amountPaid)}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                        item.status === 'paid' ? 'default' :
                        item.status === 'unpaid' ? 'destructive' :
                        'outline'
                    }
                    className={cn(
                        item.status === 'paid' && 'bg-green-100 text-green-800 border-green-200',
                        item.status === 'partial' && 'bg-yellow-100 text-yellow-800 border-yellow-200',
                        item.status === 'overpaid' && 'bg-blue-100 text-blue-800 border-blue-200',
                    )}
                  >
                    {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <CreateChargeDialog
                    landlordAccountId={landlordStripeId}
                    tenantEmail={item.tenantEmail}
                    tenantPhone={item.tenantPhone}
                    rentAmount={item.rentAmount}
                  />
                </TableCell>
              </TableRow>
            )))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
