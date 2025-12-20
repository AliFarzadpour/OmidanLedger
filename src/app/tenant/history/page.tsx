'use client';

import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collectionGroup, query, where, orderBy, doc } from 'firebase/firestore';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { Wallet, FileText, Loader2, FileDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { generateTenantStatement } from '@/lib/pdf-generator';

export default function TenantPaymentHistory() {
  const { user } = useUser();
  const firestore = useFirestore();

  // --- DATA FETCHING ---
  const tenantDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: tenantData } = useDoc(tenantDocRef);

  const propertyDocRef = useMemoFirebase(() => {
    if (!firestore || !tenantData?.associatedPropertyId) return null;
    return doc(firestore, 'properties', tenantData.associatedPropertyId);
  }, [firestore, tenantData]);
  const { data: propertyData } = useDoc(propertyDocRef);

  const paymentsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collectionGroup(firestore, 'transactions'),
      where('tenantId', '==', user.uid),
      orderBy('date', 'desc')
    );
  }, [user, firestore]);

  const { data: history, isLoading } = useCollection(paymentsQuery);

  // --- RENDER LOGIC ---
  const getSourceIcon = (desc: string) => {
    const d = desc.toLowerCase();
    if (d.includes('zelle')) return 'Zelle';
    if (d.includes('venmo')) return 'Venmo';
    if (d.includes('cash')) return 'Cash';
    if (d.includes('check')) return 'Check';
    if (d.includes('plaid')) return 'Bank (ACH)';
    return 'Direct Deposit';
  };

  const handleDownload = () => {
    if (!tenantData || !propertyData || !history) return;
    const currentMonth = format(new Date(), 'yyyy-MM');
    generateTenantStatement(tenantData, propertyData, history, currentMonth);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold">Payment History</h1>
            <p className="text-sm text-slate-500">A complete record of your rent and deposit payments.</p>
        </div>
        <Button variant="outline" onClick={handleDownload} disabled={!history || history.length === 0} className="gap-2">
            <FileDown className="h-4 w-4" />
            Download Statement
        </Button>
      </div>

      <div className="border rounded-xl bg-white overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Method</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(3)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : !history || history.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center text-slate-400">
                  No payment records found.
                </TableCell>
              </TableRow>
            ) : (
              history.map((tx: any) => (
                <TableRow key={tx.id}>
                  <TableCell className="text-slate-600">
                    {format(new Date(tx.date), 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-900">{tx.subcategory || tx.category || 'Rent Payment'}</span>
                      <span className="text-xs text-slate-500 max-w-[250px] truncate">{tx.description}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-normal bg-slate-100 text-slate-700">
                      {getSourceIcon(tx.description)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-bold text-green-600">
                    +${Math.abs(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
