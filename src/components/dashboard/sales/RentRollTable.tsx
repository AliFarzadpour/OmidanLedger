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
import { format, addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';

type Tenant = {
  id?: string;
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
  propertyId?: string; // a direct ID reference is best
  costCenter?: string; // fallback if propertyId is missing
  categoryHierarchy?: { l0?: string };
};

export function RentRollTable() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [viewingDate, setViewingDate] = useState(new Date());

  const monthStartStr = format(startOfMonth(viewingDate), 'yyyy-MM-dd');
  const monthEndStr = format(endOfMonth(viewingDate), 'yyyy-MM-dd');

  // 1) Load properties (with embedded tenants array)
  const propertiesQuery = useMemo(() => {
    if (!user?.uid || !firestore) return null;
    return query(collection(firestore, 'properties'), where('userId', '==', user.uid));
  }, [user?.uid, firestore]);

  const propertiesResult = useCollection<Property>(propertiesQuery);
  const properties = propertiesResult.data || [];
  const isLoadingProperties = propertiesResult.isLoading;


  // 2) Load all INCOME transactions for the month
  const paymentsQuery = useMemo(() => {
    if (!user?.uid || !firestore) return null;

    return query(
      collectionGroup(firestore, 'transactions'),
      where('userId', '==', user.uid),
      where('categoryHierarchy.l0', '==', 'INCOME'),
      where('date', '>=', monthStartStr),
      where('date', '<=', monthEndStr)
    );
  }, [user?.uid, firestore, monthStartStr, monthEndStr]);

  const paymentsResult = useCollection<TxnDoc>(paymentsQuery);
  const monthlyPayments = paymentsResult.data || [];
  const isLoadingPayments = paymentsResult.isLoading;

  // 3) Build Rent Roll rows
  const rows = useMemo(() => {
    if (!properties || !monthlyPayments) return [];

    // Build map: income by propertyId
    const incomeByPropertyId = (monthlyPayments || []).reduce((acc: any, tx: any) => {
      const pid = String(tx.propertyId || tx.costCenter || '').trim();
      if (!pid) return acc;

      const amt = typeof tx.amount === 'number' ? tx.amount : Number(tx.amount || 0);
      if (!Number.isFinite(amt) || amt <= 0) return acc;

      acc[pid] = (acc[pid] || 0) + amt;
      return acc;
    }, {});


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
      const activeTenants = tenants.filter(
        (t) => (t?.status || '').toLowerCase() === 'active'
      );

      for (const t of activeTenants) {
        const rentDue = Number(t.rentAmount || 0);
        const amountPaid = incomeByPropertyId[p.id] || 0;

        let status: 'unpaid' | 'paid' | 'partial' | 'overpaid' = 'unpaid';

        if (amountPaid === 0) status = 'unpaid';
        else if (amountPaid === rentDue) status = 'paid';
        else if (amountPaid < rentDue) status = 'partial';
        else status = 'overpaid';

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
                      {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
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
