
'use client';

import { useState, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowLeft, Landmark, HandCoins, Percent, CalendarDays, Pencil, FileWarning } from 'lucide-react';
import { formatCurrency } from '@/lib/format';

interface Mortgage {
  hasMortgage?: 'yes' | 'no';
  lenderName?: string;
  loanBalance?: number;
  principalAndInterest?: number;
  escrowAmount?: number;
  interestRate?: number;
}

interface Property {
  id: string;
  name: string;
  mortgage?: Mortgage;
}

function StatCard({ title, value, icon, isLoading, format = 'currency' }: { title: string, value: number, icon: React.ReactNode, isLoading: boolean, format?: 'currency' | 'percent' }) {
    const formattedValue = format === 'currency' ? formatCurrency(value) : `${value.toFixed(2)}%`;
    return (
        <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                {icon}
            </CardHeader>
            <CardContent>
                {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : (
                    <div className="text-2xl font-bold">{formattedValue}</div>
                )}
            </CardContent>
        </Card>
    );
}

export default function DebtCenterPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const propertiesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
        collection(firestore, 'properties'), 
        where('userId', '==', user.uid),
        where('mortgage.hasMortgage', '==', 'yes') // Only fetch properties with mortgages
    );
  }, [user, firestore]);

  const { data: properties, isLoading } = useCollection<Property>(propertiesQuery);

  const { totalBalance, totalMonthly, avgInterestRate } = useMemo(() => {
    if (!properties) return { totalBalance: 0, totalMonthly: 0, avgInterestRate: 0 };
    
    let balance = 0;
    let monthly = 0;
    let weightedRateSum = 0;

    properties.forEach(p => {
      const loanBalance = p.mortgage?.loanBalance || 0;
      balance += loanBalance;
      monthly += (p.mortgage?.principalAndInterest || 0) + (p.mortgage?.escrowAmount || 0);
      weightedRateSum += (p.mortgage?.interestRate || 0) * loanBalance;
    });

    const avgRate = balance > 0 ? weightedRateSum / balance : 0;

    return { totalBalance: balance, totalMonthly: monthly, avgInterestRate: avgRate };
  }, [properties]);

  const handleEdit = (propertyId: string) => {
    router.push(`/dashboard/properties/${propertyId}?tab=mortgage`);
  };

  return (
    <div className="space-y-8 p-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/sales')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Debt Center</h1>
          <p className="text-muted-foreground mt-1">A consolidated view of all property-related loans.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Total Loan Balance" value={totalBalance} icon={<Landmark className="h-5 w-5 text-muted-foreground" />} isLoading={isLoading} />
        <StatCard title="Total Monthly Payments" value={totalMonthly} icon={<CalendarDays className="h-5 w-5 text-muted-foreground" />} isLoading={isLoading} />
        <StatCard title="Avg. Interest Rate" value={avgInterestRate} icon={<Percent className="h-5 w-5 text-muted-foreground" />} isLoading={isLoading} format="percent" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mortgage Details</CardTitle>
          <CardDescription>A detailed list of all active property loans.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property</TableHead>
                <TableHead>Lender</TableHead>
                <TableHead>Loan Balance</TableHead>
                <TableHead>Monthly Payment</TableHead>
                <TableHead>Interest Rate</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center p-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : properties && properties.length > 0 ? (
                properties.map((prop) => {
                  const monthlyPayment = (prop.mortgage?.principalAndInterest || 0) + (prop.mortgage?.escrowAmount || 0);
                  return (
                    <TableRow key={prop.id}>
                      <TableCell className="font-medium">{prop.name}</TableCell>
                      <TableCell>{prop.mortgage?.lenderName || 'N/A'}</TableCell>
                      <TableCell>{formatCurrency(prop.mortgage?.loanBalance || 0)}</TableCell>
                      <TableCell>{formatCurrency(monthlyPayment)}</TableCell>
                      <TableCell>{(prop.mortgage?.interestRate || 0).toFixed(3)}%</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(prop.id)}>
                            <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                        <FileWarning className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                        No properties with mortgage data found.
                    </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
