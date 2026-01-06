'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ChevronLeft, ChevronRight, ArrowLeft, TrendingUp, Receipt, Users, CheckCircle2, AlertCircle } from 'lucide-react';
import { format, addMonths, subMonths } from 'date-fns';
import { calculateAllFees, type FeeCalculationResult } from '@/actions/calculate-billing';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Label } from '@/components/ui/label';

export default function LandlordBillingPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const [billingPeriod, setBillingPeriod] = useState(format(new Date(), 'yyyy-MM'));
  const [result, setResult] = useState<FeeCalculationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const invoiceQuery = useMemoFirebase(() => {
      if (!user || !firestore) return null;
      const period = format(new Date(billingPeriod + '-02'), 'MMMM yyyy');
      return query(
          collection(firestore, `users/${user.uid}/admin_invoices`),
          where('billingPeriod', '==', period),
          orderBy('sentAt', 'desc'),
          limit(1)
      );
  }, [user, firestore, billingPeriod]);

  const { data: invoices, isLoading: isLoadingInvoices } = useCollection(invoiceQuery);
  const latestInvoice = invoices?.[0];

  useEffect(() => {
    const handleRunReport = async () => {
      if (!user) return;
      setIsLoading(true);
      try {
        const data = await calculateAllFees({ billingPeriod });
        const userResult = data.find(r => r.userId === user.uid) || null;
        setResult(userResult);
      } catch (e: any) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };

    handleRunReport();
  }, [billingPeriod, user]);

  const handleDateChange = (direction: 'next' | 'prev') => {
    const currentDate = new Date(billingPeriod + '-02');
    const newDate = direction === 'next' ? addMonths(currentDate, 1) : subMonths(currentDate, 1);
    setBillingPeriod(format(newDate, 'yyyy-MM'));
  };

  const getStatus = () => {
    if (isLoading || isLoadingInvoices) return 'loading';
    if (!latestInvoice) return 'pending';
    if (latestInvoice.status === 'paid') return 'paid';
    return 'pending';
  };

  const status = getStatus();

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
                <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
                <h1 className="text-3xl font-bold tracking-tight">My Billing</h1>
                <p className="text-muted-foreground">View your monthly subscription fees and payment history.</p>
            </div>
        </div>

        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Billing Period</CardTitle>
                    <CardDescription>Select a month to view the detailed breakdown.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => handleDateChange('prev')}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="font-semibold text-lg w-36 text-center">
                        {format(new Date(billingPeriod + '-02'), 'MMMM yyyy')}
                    </span>
                    <Button variant="outline" size="icon" onClick={() => handleDateChange('next')}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </CardHeader>
        </Card>

        {isLoading ? (
            <div className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>
        ) : !result ? (
            <Card className="text-center py-10">
                <CardContent>
                    <p>No billing data found for this period.</p>
                </CardContent>
            </Card>
        ) : (
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle>Summary for {format(new Date(billingPeriod + '-02'), 'MMMM yyyy')}</CardTitle>
                            <CardDescription>Based on your activity during this period.</CardDescription>
                        </div>
                         <div className="flex items-center gap-3">
                            {status === 'loading' && <Badge variant="outline"><Loader2 className="mr-1 h-3 w-3 animate-spin"/>Checking...</Badge>}
                            {status === 'paid' && <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle2 className="mr-1 h-3 w-3"/>Paid</Badge>}
                            {status === 'pending' && <Badge variant="destructive"><AlertCircle className="mr-1 h-3 w-3"/>Pending</Badge>}
                            {latestInvoice?.invoiceUrl && (
                                <Button variant="outline" size="sm" asChild>
                                    <Link href={latestInvoice.invoiceUrl} target="_blank">View Invoice</Link>
                                </Button>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-3 gap-4">
                        <div className="p-4 bg-slate-50 border rounded-lg">
                            <Label className="text-sm text-muted-foreground flex items-center gap-2"><Users className="h-4 w-4"/> Active Units</Label>
                            <p className="text-2xl font-bold">{result.activeUnits}</p>
                        </div>
                         <div className="p-4 bg-slate-50 border rounded-lg">
                            <Label className="text-sm text-muted-foreground flex items-center gap-2"><TrendingUp className="h-4 w-4"/> Rent Collected</Label>
                            <p className="text-2xl font-bold">${result.totalRentCollected.toLocaleString()}</p>
                        </div>
                         <div className="p-4 bg-slate-50 border rounded-lg">
                            <Label className="text-sm text-muted-foreground flex items-center gap-2"><Receipt className="h-4 w-4"/> Monthly Fee</Label>
                            <p className="text-2xl font-bold text-primary">${result.finalMonthlyFee.toFixed(2)}</p>
                        </div>
                    </div>

                    <div>
                        <h4 className="font-semibold mb-2">Fee Calculation Breakdown</h4>
                        <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader>
                                <TableRow>
                                    <TableHead>Property / Unit</TableHead>
                                    <TableHead className="text-right">Rent Collected</TableHead>
                                    <TableHead className="text-right">Calculated Fee</TableHead>
                                </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {result.breakdown.map((item) => (
                                        <TableRow key={item.spaceId}>
                                            <TableCell>{item.spaceName}</TableCell>
                                            <TableCell className="text-right">${item.collectedRent.toLocaleString()}</TableCell>
                                            <TableCell className="text-right">${item.fee.toFixed(2)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                                <TableFooter>
                                    <TableRow className="font-bold">
                                        <TableCell colSpan={2}>Raw Calculated Fee (Sum of above)</TableCell>
                                        <TableCell className="text-right">${result.rawMonthlyFee.toFixed(2)}</TableCell>
                                    </TableRow>
                                     <TableRow className="font-bold">
                                        <TableCell colSpan={2}>Monthly Minimum</TableCell>
                                        <TableCell className="text-right">$29.00</TableCell>
                                    </TableRow>
                                    <TableRow className="text-base font-black bg-slate-100">
                                        <TableCell colSpan={2}>Final Fee (The greater of the two)</TableCell>
                                        <TableCell className="text-right">${result.finalMonthlyFee.toFixed(2)}</TableCell>
                                    </TableRow>
                                </TableFooter>
                            </Table>
                        </div>
                    </div>
                </CardContent>
            </Card>
        )}
    </div>
  );
}
