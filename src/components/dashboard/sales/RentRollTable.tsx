
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
import { Loader2, AlertCircle, Send, Check, Pencil } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { CreateChargeDialog } from './CreateChargeDialog';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, isSameMonth, parseISO, differenceInDays, isPast } from 'date-fns';
import { cn } from '@/lib/utils';
import { getDocs, collection, query, limit, where, doc, collectionGroup } from 'firebase/firestore';
import { batchCreateTenantInvoices } from '@/actions/batch-invoice-actions';
import { useToast } from '@/hooks/use-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { AssignPaymentDialog } from './AssignPaymentDialog';


interface Tenant {
    id?: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    status: 'active' | 'past';
    rentAmount: number | string;
    leaseEnd?: string;
}

interface Unit {
    id: string;
    unitNumber: string;
    tenants: Tenant[];
    financials?: {
        rent: number;
        targetRent?: number;
    };
    targetRent?: number;
    propertyId: string; 
    userId: string; 
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

interface Charge {
    id: string;
    tenantEmail: string;
    sentAt: {
        seconds: number;
        nanoseconds: number;
    } | Date;
    [key: string]: any;
}


const toNum = (v: any): number => {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const cleaned = v.replace(/[^0-9.-]/g, "", ""); // strips $ and commas safely
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};


// Helper function to fetch units in chunks
function chunk<T>(arr: T[], size = 10) {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}
  
async function fetchUnitsForProperties(firestore: any, propertyIds: string[], userId: string) {
    if (propertyIds.length === 0 || !userId) return [];
    const chunks = chunk(propertyIds, 10);
    const all: any[] = [];
  
    for (const ids of chunks) {
      const qUnits = query(
        collectionGroup(firestore, "units"),
        where("userId", "==", userId), // CRITICAL: Security rule compliance
        where("propertyId", "in", ids)
      );
      const snap = await getDocs(qUnits);
      snap.forEach((d) => all.push({ id: d.id, path: d.ref.path, ...d.data() }));
    }
  
    return all;
}


export function RentRollTable({ viewingDate }: { viewingDate: Date }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isBatching, setIsBatching] = useState(false);
  
  const [allUnits, setAllUnits] = useState<Unit[]>([]);
  const [isLoadingUnits, setIsLoadingUnits] = useState(true);

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
  
    // Fetch charges
  const chargesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, `users/${user.uid}/charges`));
  }, [user, firestore]);
  const { data: charges, isLoading: isLoadingCharges } = useCollection<Charge>(chargesQuery);

  const hasInvoiceBeenSent = useCallback((tenantEmail: string, currentMonth: Date) => {
    if (!charges) return { sent: false, date: null };

    const charge = charges.find(c => {
        if (c.tenantEmail !== tenantEmail) return false;
        
        let sentAtDate;
        if (c.sentAt instanceof Date) {
            sentAtDate = c.sentAt;
        } else if (c.sentAt && typeof c.sentAt.seconds === 'number') {
            sentAtDate = new Date(c.sentAt.seconds * 1000);
        } else {
            return false;
        }

        return isSameMonth(sentAtDate, currentMonth);
    });

    return { sent: !!charge, date: charge ? (charge.sentAt instanceof Date ? charge.sentAt : new Date((charge.sentAt as any).seconds * 1000)) : null };
  }, [charges]);

  const fetchTransactions = useCallback(async () => {
    if (!firestore || !user?.uid) return;
    
    setIsLoadingTx(true);
    setTxError(null);
    
    try {
        const monthStartStr = format(startOfMonth(viewingDate), 'yyyy-MM-dd');
        const monthEndStr = format(endOfMonth(viewingDate), 'yyyy-MM-dd');

        const txsSnap = await getDocs(query(
            collectionGroup(firestore, 'transactions'),
            where('userId', '==', user.uid),
            where('categoryHierarchy.l0', '==', 'INCOME'),
            where('date', '>=', monthStartStr),
            where('date', '<=', monthEndStr)
        ));
      
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
  }, [firestore, user?.uid, viewingDate]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);


  const propertiesQuery = useMemoFirebase(() => {
    if (!user?.uid || !firestore) return null;
    return query(collection(firestore, 'properties'), where('userId', '==', user.uid));
  }, [user?.uid, firestore]);
  
  const { data: properties, isLoading: isLoadingProperties } = useCollection<Property>(propertiesQuery);

  useEffect(() => {
    if (!properties || !firestore || !user?.uid) return;
    setIsLoadingUnits(true);
    const propertyIds = properties.map(p => p.id);
    fetchUnitsForProperties(firestore, propertyIds, user.uid)
        .then(units => {
            setAllUnits(units);
        })
        .catch(err => {
            console.error("Failed to fetch units:", err);
        })
        .finally(() => {
            setIsLoadingUnits(false);
        })
  }, [properties, firestore, user?.uid]);

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
  
    const singleFamilyRows = (properties || [])
      .filter(p => !p.isMultiUnit)
      .flatMap((p, propIndex) => {
        const activeTenants = p.tenants?.filter(t => t.status === 'active') || [];
        return activeTenants.map((t, tenantIndex) => ({
          uniqueKey: `${p.id}-${t.email || tenantIndex}`,
          propertyId: p.id,
          unitId: null,
          propertyName: p.name,
          tenantId: t.id || t.email,
          tenantName: `${t.firstName} ${t.lastName}`,
          tenantEmail: t.email,
          tenantPhone: t.phone,
          rentDue: toNum(t.rentAmount),
          leaseEnd: t.leaseEnd,
        }));
      });
  
    const multiFamilyRows = (allUnits || []).flatMap((unit, unitIndex) => {
        const parentProperty = propertyMap.get(unit.propertyId);
        if (!parentProperty) return [];
    
        const activeTenants = (unit.tenants || []).filter(t => t.status === 'active');
        if (activeTenants.length === 0) return [];
        
        return activeTenants.map((t, tenantIndex) => {
          const rentDue =
              toNum(t.rentAmount) ||
              toNum(unit.financials?.rent) ||
              toNum(unit.financials?.targetRent) ||
              toNum(unit.targetRent) ||
              0;
  
          return {
              uniqueKey: `${unit.propertyId}-${unit.id}-${t.email || tenantIndex}`,
              propertyId: unit.propertyId,
              unitId: unit.id,
              propertyName: `${parentProperty.name} #${unit.unitNumber}`,
              tenantId: t.id || t.email,
              tenantName: `${t.firstName} ${t.lastName}`,
              tenantEmail: t.email,
              tenantPhone: t.phone,
              rentDue,
              leaseEnd: t.leaseEnd,
          };
        });
      });
  
    const combinedRows = [...singleFamilyRows, ...multiFamilyRows];
    const visibleRows = combinedRows;

    const enrichedRows = visibleRows.map(row => {
      const amountPaid = (row.unitId ? incomeByPropertyOrUnit[row.unitId] : 0) || incomeByPropertyOrUnit[row.propertyId] || 0;
      const balance = row.rentDue - amountPaid;
  
      let paymentStatus: 'unpaid' | 'paid' | 'partial' | 'overpaid' = 'unpaid';
      if (row.rentDue > 0) {
        if (amountPaid === 0) paymentStatus = 'unpaid';
        else if (amountPaid >= row.rentDue) paymentStatus = 'paid';
        else if (amountPaid > 0) paymentStatus = 'partial';
      }
      if (amountPaid > row.rentDue && row.rentDue > 0) paymentStatus = 'overpaid';

      let leaseStatus: 'safe' | 'expiring' | 'expired' = 'safe';
      if (row.leaseEnd) {
          const leaseEndDate = parseISO(row.leaseEnd);
          if (isPast(leaseEndDate)) {
              leaseStatus = 'expired';
          } else if (differenceInDays(leaseEndDate, new Date()) <= 30) {
              leaseStatus = 'expiring';
          }
      }
  
      return {
        ...row,
        amountPaid,
        balance,
        status: paymentStatus,
        leaseStatus
      };
    });

    // Sort the rows: Unpaid > Partial > Overpaid > Paid
    enrichedRows.sort((a, b) => {
        const statusSortOrder = {
            unpaid: 1,
            partial: 2,
            overpaid: 3,
            paid: 4,
        };
        const statusA = statusSortOrder[a.status];
        const statusB = statusSortOrder[b.status];
        return statusA - statusB;
    });

    return enrichedRows;
  
  }, [properties, allUnits, incomeByPropertyOrUnit]);
  
  const unpaidTenants = useMemo(() => {
    return rentRoll.filter(item => {
      if (!item) return false;
      const invoiceStatus = hasInvoiceBeenSent(item.tenantEmail, viewingDate);
      return (item.status === 'unpaid' || item.status === 'partial') && !invoiceStatus.sent;
    });
  }, [rentRoll, hasInvoiceBeenSent, viewingDate]);
  
  
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
    if (!user) return;

    setIsBatching(true);
    const invoicesToSend = unpaidTenants.map(tenant => ({
      userId: user.uid,
      landlordAccountId: landlordStripeId,
      tenantEmail: tenant!.tenantEmail,
      tenantPhone: tenant!.tenantPhone,
      amount: tenant!.balance > 0 ? tenant!.balance : tenant!.rentDue,
      description: `Rent for ${format(viewingDate, 'MMMM yyyy')}`,
      propertyName: tenant!.propertyName,
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

  const leaseStatusConfig = {
      safe: { color: 'bg-green-500', label: 'Lease is active and not ending soon.' },
      expiring: { color: 'bg-orange-500', label: 'Lease is expiring within 30 days.' },
      expired: { color: 'bg-red-500', label: 'Lease has expired.' },
  };

  const isLoading = isLoadingProperties || isLoadingTx || isLoadingUnits || isLoadingCharges;

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
            </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Property</TableHead>
              <TableHead>Tenant</TableHead>
              <TableHead>Rent Due</TableHead>
              <TableHead className="text-right">Amount Paid</TableHead>
              <TableHead className="w-12"></TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                <TableRow>
                    <TableCell colSpan={8} className="text-center p-8">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground"/>
                    </TableCell>
                </TableRow>
            ) : rentRoll.length === 0 ? (
                 <TableRow>
                    <TableCell colSpan={8} className="text-center p-8">
                        <p className="font-semibold">No Active Leases with Rent Due Found</p>
                        <p className="text-sm text-muted-foreground">Add tenants with rent amounts to your properties to see them here.</p>
                    </TableCell>
                </TableRow>
            ) : (
                rentRoll.map((item) => {
                    const invoiceStatus = hasInvoiceBeenSent(item.tenantEmail, viewingDate);
                    return item && (
                        <TableRow key={item.uniqueKey}>
                            <TableCell>
                            <TooltipProvider>
                                <Tooltip>
                                <TooltipTrigger>
                                    <div className={cn("h-3 w-3 rounded-full", leaseStatusConfig[item.leaseStatus].color)} />
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{leaseStatusConfig[item.leaseStatus].label}</p>
                                </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                            </TableCell>
                            <TableCell className="font-medium">{item.propertyName}</TableCell>
                            <TableCell>{item.tenantName}</TableCell>
                            <TableCell>{formatCurrency(item.rentDue)}</TableCell>
                            <TableCell className="font-medium text-green-700 text-right">
                                {formatCurrency(item.amountPaid)}
                            </TableCell>
                            <TableCell>
                                <AssignPaymentDialog 
                                    tenant={item} 
                                    viewingDate={viewingDate} 
                                    onSuccess={fetchTransactions} 
                                />
                            </TableCell>
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
                                {invoiceStatus.sent ? (
                                    <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
                                        <Check className="h-4 w-4 text-green-500" />
                                        Sent {format(invoiceStatus.date!, 'MM/dd/yy')}
                                    </div>
                                ) : (
                                    <CreateChargeDialog
                                        landlordAccountId={landlordStripeId}
                                        tenantEmail={item.tenantEmail}
                                        tenantPhone={item.tenantPhone}
                                        rentAmount={item.balance > 0 ? item.balance : item.rentDue}
                                        propertyName={item.propertyName}
                                    />
                                )}
                            </TableCell>
                        </TableRow>
                    )
                })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
