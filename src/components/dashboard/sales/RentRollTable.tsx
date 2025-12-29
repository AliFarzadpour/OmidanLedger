
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
    rentAmount: number | string;
}

interface Unit {
    id: string;
    unitNumber: string;
    tenants: Tenant[];
    financials?: {
        rent: number;
    };
    propertyId: string; // Ensure this exists for linking back
    userId: string; // Ensure this exists for the query
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
        const txsSnap = await getDocs(
          query(
            collectionGroup(firestore, 'transactions'),
            where('userId', '==', user.uid),
            where('categoryHierarchy.l0', '==', 'Income'),
            where('date', '>=', monthStartStr),
            where('date', '<=', monthEndStr)
          )
        );
        
        const allTx: Tx[] = [];
        txsSnap.docs.forEach(doc => {
            allTx.push({ id: doc.id, ...doc.data() });
        });
  
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
  const { data: allUnits, isLoading: isLoadingUnits } = useCollection<Unit>(unitsQuery);
  
  const incomeByPropertyOrUnit = useMemo(() => {
    const map: Record<string, number> = {};
    for (const tx of monthlyIncomeTx) {
      const id = String(tx.costCenter || '').trim();
      if (!id) continue;
  
      const amt = typeof tx.amount === 'number' ? tx.amount : Number(tx.amount || 0);
      if (!Number.isFinite(amt) || amt <= 0) continue;
  
      map[id] = (map[id] || 0) + amt;
    }
    return map;
  }, [monthlyIncomeTx]);


  const rentRoll = useMemo(() => {
    if (!properties) return [];

    const propertyMap = new Map((properties || []).map(p => [p.id, p]));
  
    // 1. Process single-family properties
    const singleFamilyRows = (properties || [])
      .filter(p => !p.isMultiUnit)
      .flatMap(p => {
        const activeTenants = p.tenants?.filter(t => t.status === 'active') || [];
        return activeTenants.map(t => ({
          propertyId: p.id,
          unitId: null,
          propertyName: p.name,
          tenantId: t.id || t.email,
          tenantName: `${t.firstName} ${t.lastName}`,
          tenantEmail: t.email,
          tenantPhone: t.phone,
          rentDue: toNum(t.rentAmount),
        }));
      });
  
    // 2. Process multi-family properties by iterating through all units
    const multiFamilyRows = (allUnits || []).flatMap(unit => {
      const parentProperty = propertyMap.get(unit.propertyId);
      if (!parentProperty) return [];
  
      const activeTenants = (unit.tenants || []).filter(t => t.status === 'active');
      if (activeTenants.length === 0) return [];
      
      return activeTenants.map(t => ({
        propertyId: unit.propertyId,
        unitId: unit.id,
        propertyName: `${parentProperty.name} #${unit.unitNumber}`,
        tenantId: t.id || t.email,
        tenantName: `${t.firstName} ${t.lastName}`,
        tenantEmail: t.email,
        tenantPhone: t.phone,
        rentDue: toNum(t.rentAmount) || toNum(unit.financials?.rent),
      }));
    });
  
    const combinedRows = [...singleFamilyRows, ...multiFamilyRows];

    // DEBUGGING: Show all rows before final filtering
    console.log("SF rows (pre-filter):", singleFamilyRows.length, singleFamilyRows[0]);
    console.log("MF rows (pre-filter):", multiFamilyRows.length, multiFamilyRows[0]);
    console.log("ALL rows (pre-filter):", combinedRows.length, combinedRows[0]);
    
    const visibleRows = combinedRows;

    return visibleRows.map(row => {
      // Prioritize unit-level income, then fall back to property-level
      const amountPaid = (row.unitId ? incomeByPropertyOrUnit[row.unitId] : 0) || incomeByPropertyOrUnit[row.propertyId] || 0;
      const balance = row.rentDue - amountPaid;
  
      let status: 'unpaid' | 'paid' | 'partial' | 'overpaid' = 'unpaid';
      if (row.rentDue > 0) {
        if (amountPaid === 0) status = 'unpaid';
        else if (amountPaid >= row.rentDue) status = 'paid';
        else if (amountPaid > 0) status = 'partial';
      }
      if (amountPaid > row.rentDue && row.rentDue > 0) status = 'overpaid';
  
      return {
        ...row,
        amountPaid,
        balance,
        status
      };
    });
  
  }, [properties, allUnits, incomeByPropertyOrUnit]);
  
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
      amount: tenant!.balance > 0 ? tenant!.balance : tenant!.rentDue,
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

  const isLoading = isLoadingProperties || isLoadingTx || isLoadingUnits;

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
                <TableCell>{formatCurrency(item.rentDue)}</TableCell>
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
                    rentAmount={item.rentDue}
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
