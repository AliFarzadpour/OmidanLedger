'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
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
import { Loader2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { CreateChargeDialog } from './CreateChargeDialog';
import { RecordPaymentModal } from './RecordPaymentModal';
import { format, addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { getDocs, collection, query, limit, where } from 'firebase/firestore';


interface Tenant {
    id?: string;
    firstName: string;
    lastName: string;
    email: string;
    status: 'active' | 'past';
    rentAmount: number;
}

interface Property {
    id: string;
    name: string;
    address: {
        street: string;
    };
    tenants: Tenant[];
}

type Tx = any;

export function RentRollTable() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [viewingDate, setViewingDate] = useState(new Date());

  const { startOfMonth, endOfMonth } = useMemo(() => {
    return {
      startOfMonth: startOfMonth(viewingDate),
      endOfMonth: endOfMonth(viewingDate),
    }
  }, [viewingDate]);

  const monthStartStr = useMemo(() => format(startOfMonth, 'yyyy-MM-dd'), [startOfMonth]);
  const monthEndStr = useMemo(() => format(endOfMonth, 'yyyy-MM-dd'), [endOfMonth]);

  const propertiesQuery = useMemo(() => {
    if (!user?.uid || !firestore) return null;
  
    // Use whichever one matches your real location:
    // OPTION A: top-level properties
    return query(collection(firestore, 'properties'), where('userId', '==', user.uid));
  
    // OPTION B (if properties are under users/{uid}/properties):
    // return query(collection(firestore, 'users', user.uid, 'properties'));
  }, [user?.uid, firestore]);
  
  const [monthlyIncomeTx, setMonthlyIncomeTx] = useState<Tx[]>([]);
  const [isLoadingTx, setIsLoadingTx] = useState(false);
  const [txError, setTxError] = useState<any>(null);

  useEffect(() => {
    (async () => {
      if (!firestore || !user?.uid) return;
  
      try {
        const txRef = collection(
          firestore,
          'users',
          user.uid,
          'bankAccounts',
          'Z8xN5jZ15puw1pdVw3qXFwK57PQbg7s8OMQ6j',
          'transactions'
        );
  
        const snap = await getDocs(query(txRef, limit(3)));
        console.log('DIRECT TX READ size:', snap.size);
        console.log('DIRECT TX READ sample:', snap.docs[0]?.data());
      } catch (e) {
        console.error('DIRECT TX READ error:', e);
      }
    })();
  }, [firestore, user?.uid]);
  
  const propertiesResult = useMemo(() => {
    // This is a placeholder until useCollection is fixed or replaced
    if (!propertiesQuery) return { data: [], isLoading: true };
    // A proper implementation would fetch data based on propertiesQuery
    return { data: [], isLoading: true };
  }, [propertiesQuery]);

  const properties = propertiesResult.data || [];
  const isLoadingProperties = propertiesResult.isLoading;


  const rentRoll = useMemo(() => {
    if (!properties) return [];

    const incomeByPropertyId = (monthlyIncomeTx || []).reduce((acc: any, tx: any) => {
      const pid = String(tx.propertyId || tx.costCenter || '').trim();
      if (!pid) return acc;
    
      const amt = typeof tx.amount === 'number' ? tx.amount : Number(tx.amount || 0);
      if (!Number.isFinite(amt) || amt <= 0) return acc;
    
      acc[pid] = (acc[pid] || 0) + amt;
      return acc;
    }, {});


    return properties.flatMap(p => {
        const activeTenant = p.tenants?.find((t: any) => (t.status || '').toLowerCase() === 'active');
        if (!activeTenant || !(activeTenant.id || activeTenant.email)) return [];

        const tenantIdentifier = activeTenant.id || activeTenant.email;
        const rentDue = activeTenant.rentAmount || 0;
        const amountPaid = incomeByPropertyId[p.id] || 0;
        const balance = rentDue - amountPaid;

        let status: 'unpaid' | 'paid' | 'partial' | 'overpaid' = 'unpaid';

        if (amountPaid === 0) status = 'unpaid';
        else if (amountPaid === rentDue) status = 'paid';
        else if (amountPaid < rentDue) status = 'partial';
        else status = 'overpaid';

        return {
            propertyId: p.id,
            propertyName: p.name,
            tenantId: tenantIdentifier,
            tenantName: `${activeTenant.firstName} ${activeTenant.lastName}`,
            tenantEmail: activeTenant.email,
            rentAmount: rentDue,
            amountPaid: amountPaid,
            balance: balance,
            status: status
        };
    });
  }, [properties, monthlyIncomeTx]);
  
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
                        <p className="font-semibold">No Active Leases Found</p>
                        <p className="text-sm text-muted-foreground">Add tenants to your properties to see them here.</p>
                    </TableCell>
                </TableRow>
            ) : (
                rentRoll.map((item) => (
              <TableRow key={item.propertyId}>
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
                <TableCell className="text-right space-x-2">
                    {user && (
                      <RecordPaymentModal 
                        tenant={{id: item.tenantId, firstName: item.tenantName, rentAmount: item.rentAmount}}
                        propertyId={item.propertyId}
                        landlordId={user.uid}
                      />
                    )}
                    <CreateChargeDialog 
                        // @ts-ignore
                        defaultTenantEmail={item.tenantEmail}
                        defaultAmount={item.balance > 0 ? item.balance : undefined}
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
