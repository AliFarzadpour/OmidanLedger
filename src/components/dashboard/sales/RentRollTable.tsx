
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
  
  const [monthlyIncomeTx, setMonthlyIncomeTx] = useState<Tx[]>([]);
  const [isLoadingTx, setIsLoadingTx] = useState(false);
  const [txError, setTxError] = useState<any>(null);

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
        // 1) get user's bank accounts
        const baSnap = await getDocs(
          query(
            collection(firestore, 'users', user.uid, 'bankAccounts')
          )
        );

        const bankAccountIds = baSnap.docs.map(d => d.id);
  
        // 2) for each bank account, query its transactions for the month
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

  const propertiesQuery = useMemo(() => {
    if (!user?.uid || !firestore) return null;
    return query(collection(firestore, 'properties'), where('userId', '==', user.uid));
  }, [user?.uid, firestore]);
  
  const { data: properties, isLoading: isLoadingProperties, refetch } = useCollection<Property>(propertiesQuery);

  const incomeByPropertyId = useMemo(() => {
    const map: Record<string, number> = {};
    for (const tx of monthlyIncomeTx) {
      const pid = String(tx.propertyId || tx.costCenter || '').trim();
      if (!pid) continue;
  
      const amt = typeof tx.amount === 'number' ? tx.amount : Number(tx.amount || 0);
      if (!Number.isFinite(amt) || amt <= 0) continue;
  
      map[pid] = (map[pid] || 0) + amt;
    }
    return map;
  }, [monthlyIncomeTx]);

  const rentRoll = useMemo(() => {
    if (!properties) return [];

    return properties.flatMap(p => {
        const activeTenant = p.tenants?.find((t: any) => (t.status || '').toLowerCase() === 'active');
        if (!activeTenant || !(activeTenant.id || activeTenant.email)) return [];

        const tenantIdentifier = activeTenant.id || activeTenant.email;
        const rentDue = activeTenant.rentAmount || 0;
        
        const amountPaid = incomeByPropertyId[p.id] || 0;
        const balance = rentDue - amountPaid;

        let status: 'unpaid' | 'paid' | 'partial' | 'overpaid' = 'unpaid';

        if (amountPaid === 0) {
            status = 'unpaid';
        } else if (amountPaid === rentDue) {
            status = 'paid';
        } else if (amountPaid < rentDue) {
            status = 'partial';
        } else {
            status = 'overpaid';
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
            status: status
        };
    });
  }, [properties, incomeByPropertyId]);
  
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
                <TableCell className="text-right">
                  <CreateChargeDialog />
                </TableCell>
              </TableRow>
            )))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// Added this to fix the ReferenceError, as useCollection was not imported
function useCollection<T>(query: any) {
    const [data, setData] = useState<T[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<any>(null);

    const refetch = useCallback(() => {
        if (!query) return;
        setIsLoading(true);
        getDocs(query)
            .then(snapshot => {
                const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
                setData(results);
            })
            .catch(err => setError(err))
            .finally(() => setIsLoading(false));
    }, [query]);

    useEffect(() => {
        refetch();
    }, [refetch]);

    return { data, isLoading, error, refetch };
}
