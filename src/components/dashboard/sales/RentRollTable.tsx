'use client';

import { useMemo, useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, collectionGroup, query, where } from 'firebase/firestore';
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
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { getBillingPeriod } from '@/lib/dates';
import { format, addMonths, subMonths } from 'date-fns';
import { cn } from '@/lib/utils';

type Tenant = {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  status: 'active' | 'past';
  rentAmount: number;
  leaseStart?: string;
  leaseEnd?: string;
  userId: string;
  deposit?: number;
};

type Property = {
  id: string;
  userId: string;
  name: string; // cost center
  tenants?: Tenant[]; // <-- IMPORTANT: embedded array
};

type TxnDoc = {
  amount: number; // income should be positive
  date: any; // Timestamp
  userId: string;

  // MUST be the property name per your design
  costCenter?: string;

  categoryHierarchy?: { l0?: string };
};

export function RentRollTable() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [viewingDate, setViewingDate] = useState(new Date());

  const { startOfMonth, endOfMonth } = getBillingPeriod(viewingDate);

  // 1) Load properties (with embedded tenants array)
  const propertiesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'properties'), where('userId', '==', user.uid));
  }, [user, firestore]);

  // 2) Load all INCOME transactions for the month
  const incomeTxQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collectionGroup(firestore, 'transactions'),
      where('userId', '==', user.uid),
      where('date', '>=', startOfMonth),
      where('date', '<=', endOfMonth),
      where('categoryHierarchy.l0', '==', 'Income')
    );
  }, [user, firestore, startOfMonth, endOfMonth]);
  
  console.log('firestore?', !!firestore);
  console.log('propertiesQuery:', propertiesQuery);
  console.log('paymentsQuery:', incomeTxQuery);

  const propertiesResult = useCollection<Property>(propertiesQuery);
  const paymentsResult = useCollection<any>(incomeTxQuery);

  console.log('propertiesResult:', propertiesResult);
  console.log('paymentsResult:', paymentsResult);

  const properties = (propertiesResult as any)?.data;
  const isLoadingProperties = (propertiesResult as any)?.isLoading;
  const monthlyPayments = (paymentsResult as any)?.data;
  const isLoadingPayments = (paymentsResult as any)?.isLoading;

  // DEBUG SNAPSHOT
  console.log('AUTH UID:', user?.uid);
  console.log('PROPERTIES COUNT:', properties?.length);
  console.log('FIRST PROPERTY:', properties?.[0]);
  console.log('FIRST PROPERTY TENANTS:', properties?.[0]?.tenants);
  console.log('MONTHLY PAYMENTS COUNT:', monthlyPayments?.length);
  console.log('FIRST PAYMENT:', monthlyPayments?.[0]);

  // 3) Build Rent Roll rows
  const rows = useMemo(() => {
    if (!properties || !monthlyPayments) return [];

    // Sum income by costCenter (property name)
    const incomeByCostCenter = new Map<string, number>();
    for (const tx of monthlyPayments) {
      const cc = (tx.costCenter || '').trim();
      if (!cc) continue;

      const amt = typeof tx.amount === 'number' ? tx.amount : 0;
      if (amt <= 0) continue;

      incomeByCostCenter.set(cc, (incomeByCostCenter.get(cc) || 0) + amt);
    }

    // One row per ACTIVE tenant
    const out: Array<{
      propertyName: string;
      tenantName: string;
      rentDue: number;
      amountPaid: number;
      status: 'unpaid' | 'paid' | 'partial' | 'overpaid';
    }> = [];

    for (const p of properties) {
      const tenants = Array.isArray(p.tenants) ? p.tenants : [];
      const activeTenants = tenants.filter((t) => (t?.status || '').toLowerCase() === 'active');

      for (const t of activeTenants) {
        const rentDue = Number(t.rentAmount || 0);

        // per your rule: sum all income for that property name in that month
        const amountPaid = Number(incomeByCostCenter.get(p.name) || 0);

        let status: 'unpaid' | 'paid' | 'partial' | 'overpaid' = 'unpaid';
        if (amountPaid === 0 && rentDue > 0) status = 'unpaid';
        else if (amountPaid === rentDue) status = 'paid';
        else if (rentDue > amountPaid && amountPaid > 0) status = 'partial';
        else if (amountPaid > rentDue) status = 'overpaid';
        else if (rentDue === 0 && amountPaid === 0) status = 'paid';


        out.push({
          propertyName: p.name,
          tenantName: `${t.firstName || ''} ${t.lastName || ''}`.trim() || '(Unnamed Tenant)',
          rentDue,
          amountPaid,
          status,
        });
      }
    }

    return out;
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
            <Button
              variant="outline"
              size="icon"
              onClick={() => setViewingDate((d) => subMonths(d, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setViewingDate((d) => addMonths(d, 1))}
            >
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
              {/* Actions column removed per request */}
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center p-8">
                  <p className="font-semibold">No Active Leases Found</p>
                  <p className="text-sm text-muted-foreground">
                    Tenants must be in properties.tenants[] with status = "active".
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r, idx) => (
                <TableRow key={`${r.propertyName}-${r.tenantName}-${idx}`}>
                  <TableCell className="font-medium">{r.propertyName}</TableCell>
                  <TableCell>{r.tenantName}</TableCell>
                  <TableCell>{formatCurrency(r.rentDue)}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(r.amountPaid)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={r.status === 'unpaid' ? 'destructive' : 'outline'}
                      className={cn(
                        r.status === 'paid' && 'bg-green-100 text-green-800 border-green-200',
                        r.status === 'partial' && 'bg-orange-100 text-orange-800 border-orange-200',
                        r.status === 'overpaid' && 'bg-blue-100 text-blue-800 border-blue-200'
                      )}
                    >
                      {r.status === 'unpaid'
                        ? 'Unpaid'
                        : r.status === 'paid'
                        ? 'Paid'
                        : r.status === 'partial'
                        ? 'Partial'
                        : 'Overpaid'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
