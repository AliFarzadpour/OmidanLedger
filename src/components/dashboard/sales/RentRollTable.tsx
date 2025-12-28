
'use client';

import { useMemo, useState } from 'react';
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
import { Loader2, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { getBillingPeriod } from '@/lib/dates';
import { CreateChargeDialog } from './CreateChargeDialog';
import { RecordPaymentModal } from './RecordPaymentModal';
import { format } from 'date-fns';


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

  const propertiesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'properties'), where('userId', '==', user.uid));
  }, [user, firestore]);

  const { data: properties, isLoading: isLoadingProperties } = useCollection<Property>(propertiesQuery);
  
  const { startOfMonth, endOfMonth } = getBillingPeriod();
  
  const paymentsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collectionGroup(firestore, 'transactions'),
      where('userId', '==', user.uid),
      where('date', '>=', startOfMonth),
      where('date', '<=', endOfMonth),
      where('categoryHierarchy.l1', 'in', ['Rental Income', 'Uncategorized'])
    );
  }, [user, firestore, startOfMonth, endOfMonth]);
  
  const { data: monthlyPayments, isLoading: isLoadingPayments } = useCollection(paymentsQuery);


  const rentRoll = useMemo(() => {
    if (!properties) return [];

    const paymentsByTenant = (monthlyPayments || []).reduce((acc: any, p: any) => {
        if(p.tenantId) {
            acc[p.tenantId] = (acc[p.tenantId] || 0) + p.amount;
        }
        return acc;
    }, {});

    return properties.flatMap(p => {
        const activeTenant = p.tenants?.find((t: any) => t.status === 'active');
        if (!activeTenant || !(activeTenant.id || activeTenant.email)) return [];

        const tenantIdentifier = activeTenant.id || activeTenant.email;
        const rentDue = activeTenant.rentAmount || 0;
        const rentPaid = paymentsByTenant[tenantIdentifier] || 0;
        const balance = rentDue - rentPaid;

        let paymentStatus: 'paid' | 'unpaid' | 'partial' | 'overpaid' = 'unpaid';
        if (rentPaid >= rentDue && rentDue > 0) {
            paymentStatus = 'paid';
        } else if (rentPaid > 0) {
            paymentStatus = 'partial';
        }
        
        if (rentPaid > rentDue && rentDue > 0) {
            paymentStatus = 'overpaid';
        }

        return {
            propertyId: p.id,
            propertyName: p.name,
            tenantId: tenantIdentifier,
            tenantName: `${activeTenant.firstName} ${activeTenant.lastName}`,
            tenantEmail: activeTenant.email,
            rentAmount: rentDue,
            amountPaid: rentPaid,
            balance: balance,
            status: paymentStatus
        };
    });
  }, [properties, monthlyPayments]);
  
  const isLoading = isLoadingProperties || isLoadingPayments;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Current Rent Roll</CardTitle>
        <CardDescription>
          Payment status for the billing period of {format(new Date(), 'MMMM yyyy')}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Property</TableHead>
              <TableHead>Tenant</TableHead>
              <TableHead>Rent Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                <TableRow>
                    <TableCell colSpan={5} className="text-center p-8">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground"/>
                    </TableCell>
                </TableRow>
            ) : rentRoll.length === 0 ? (
                 <TableRow>
                    <TableCell colSpan={5} className="text-center p-8">
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
                <TableCell>
                  <Badge
                    variant={
                        item.status === 'paid' ? 'secondary' :
                        item.status === 'unpaid' ? 'destructive' :
                        'outline'
                    }
                     className={
                        item.status === 'paid' ? 'bg-green-100 text-green-800' :
                        item.status === 'partial' ? 'bg-yellow-100 text-yellow-800' : ''
                     }
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
