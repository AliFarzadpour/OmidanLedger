'use client';

import { useMemo, useState, useCallback } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, collectionGroup } from 'firebase/firestore';
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
import { getBillingPeriod } from '@/lib/dates';
import { CreateChargeDialog } from './CreateChargeDialog';
import { RecordPaymentModal } from './RecordPaymentModal';
import { format, addMonths, subMonths } from 'date-fns';
import { cn } from '@/lib/utils';


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

export function RentRollTable() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [viewingDate, setViewingDate] = useState(new Date());

  const propertiesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collectionGroup(firestore, 'properties'), where('userId', '==', user.uid));
  }, [user, firestore]);

  const { data: properties, isLoading: isLoadingProperties } = useCollection<Property>(propertiesQuery);
  
  const { startOfMonth, endOfMonth } = getBillingPeriod(viewingDate);
  
  const paymentsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collectionGroup(firestore, 'transactions'),
      where('userId', '==', user.uid),
      where('date', '>=', startOfMonth),
      where('date', '<=', endOfMonth),
      where('categoryHierarchy.l0', '==', 'Income')
    );
  }, [user, firestore, startOfMonth, endOfMonth]);
  
  const { data: monthlyPayments, isLoading: isLoadingPayments } = useCollection(paymentsQuery);

  console.log('AUTH UID:', user?.uid);
  console.log('PROPERTIES COUNT:', properties?.length);
  console.log('FIRST PROPERTY:', properties?.[0]);
  console.log('FIRST PROPERTY TENANTS:', properties?.[0]?.tenants);
  console.log('MONTHLY PAYMENTS COUNT:', monthlyPayments?.length);
  console.log('FIRST PAYMENT:', monthlyPayments?.[0]);


  const rentRoll = useMemo(() => {
    if (!properties) return [];

    const incomeByCostCenter = (monthlyPayments || []).reduce((acc: any, tx: any) => {
        const cc = (tx.costCenter || tx.costCenterName || tx.propertyName || '').trim();
        if (!cc) return acc;
      
        const amt = typeof tx.amount === 'number' ? tx.amount : Number(tx.amount || 0);
        if (!Number.isFinite(amt) || amt <= 0) return acc;
      
        acc[cc] = (acc[cc] || 0) + amt;
        return acc;
    }, {});

    return properties.flatMap(p => {
        const activeTenant = p.tenants?.find((t: any) => (t?.status || '').toLowerCase() === 'active');
        if (!activeTenant || !(activeTenant.id || activeTenant.email)) return [];

        const tenantIdentifier = activeTenant.id || activeTenant.email;
        const rentDue = activeTenant.rentAmount || 0;
        const amountPaid = Number(incomeByCostCenter[p.name] || 0);
        const balance = rentDue - amountPaid;

        let paymentStatus: 'paid' | 'unpaid' | 'partial' | 'overpaid' = 'unpaid';
        if (rentDue <= 0 && amountPaid <= 0) {
            paymentStatus = 'paid';
        } else if (amountPaid >= rentDue) {
            paymentStatus = 'paid';
        } else if (rentPaid > 0) {
            paymentStatus = 'partial';
        }
        
        if (amountPaid > rentDue && rentDue > 0) {
            paymentStatus = 'overpaid';
        }

        return {
            propertyId: p.id,
            propertyName: p.name,
            tenantId: tenantIdentifier,
            tenantName: `${activeTenant.firstName} ${activeTenant.lastName}`,
            tenantEmail: activeTenant.email,
            rentAmount: rentDue,
            amountPaid: amountPaid,
            balance: balance,
            status: paymentStatus
        };
    });
  }, [properties, monthlyPayments]);
  
  const isLoading = isLoadingProperties || isLoadingPayments;

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
                        item.status === 'partial' && 'bg-orange-100 text-orange-800 border-orange-200',
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
                </TableCell>
              </TableRow>
            )))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
