'use client';

import { useMemo } from 'react';
import { collectionGroup, query, where, orderBy } from 'firebase/firestore';
import { useFirestore, useUser, useCollection } from '@/firebase';
import { formatCurrency } from '@/lib/format';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

type Transaction = {
  id: string;
  date: string;
  description: string;
  amount: number;
  primaryCategory: string;
  secondaryCategory: string;
  subcategory: string;
  userId: string;
};

// New 3-level nested structure
type GroupedData = {
  [primary: string]: {
    total: number;
    secondaryGroups: {
      [secondary: string]: {
        total: number;
        transactions: Transaction[];
      }
    }
  }
};


export function DetailedLedgerReport() {
  const { user } = useUser();
  const firestore = useFirestore();

  const transactionsQuery = useMemo(() => {
    if (!user || !firestore) return null;
    return query(
      collectionGroup(firestore, 'transactions'),
      where('userId', '==', user.uid),
      orderBy('date', 'desc')
    );
  }, [user, firestore]);

  const { data: transactions, isLoading, error } = useCollection<Transaction>(transactionsQuery);

  const groupedData = useMemo(() => {
    if (!transactions) return {};
    
    return transactions.reduce((acc, tx) => {
      const primary = tx.primaryCategory || 'Uncategorized';
      const secondary = tx.secondaryCategory || 'Uncategorized';

      // Ensure primary group exists
      if (!acc[primary]) {
        acc[primary] = { total: 0, secondaryGroups: {} };
      }

      // Ensure secondary group exists within primary
      if (!acc[primary].secondaryGroups[secondary]) {
        acc[primary].secondaryGroups[secondary] = { total: 0, transactions: [] };
      }

      // Add amount to totals and push transaction
      acc[primary].total += tx.amount;
      acc[primary].secondaryGroups[secondary].total += tx.amount;
      acc[primary].secondaryGroups[secondary].transactions.push(tx);

      return acc;
    }, {} as GroupedData);

  }, [transactions]);

  const sortedPrimaryCategories = useMemo(() => {
    return Object.keys(groupedData).sort((a, b) => Math.abs(groupedData[b].total) - Math.abs(groupedData[a].total));
  }, [groupedData]);
  
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-8 w-1/3" />
              </CardHeader>
            </Card>
          ))}
        </div>
      );
    }
  
    if (error) {
      return (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Data</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      );
    }
  
    if (!transactions || transactions.length === 0) {
      return (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            No transactions found.
          </CardContent>
        </Card>
      );
    }

    return (
        <Accordion type="multiple" className="w-full space-y-4">
            {sortedPrimaryCategories.map((primaryCategory) => {
                const primaryGroup = groupedData[primaryCategory];
                return (
                    <AccordionItem key={primaryCategory} value={primaryCategory} className="border-none">
                        <Card className="shadow-md bg-white">
                        <AccordionTrigger className="p-6 hover:no-underline">
                            <div className="flex justify-between items-center w-full">
                                <div className="text-left">
                                    <h3 className="text-xl font-semibold">{primaryCategory}</h3>
                                </div>
                                <div className={cn("text-xl font-bold", primaryGroup.total >= 0 ? "text-green-600" : "text-slate-800")}>
                                    {formatCurrency(primaryGroup.total)}
                                </div>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-6 pb-6">
                           <Accordion type="multiple" className="w-full space-y-2">
                                {Object.keys(primaryGroup.secondaryGroups).sort((a, b) => Math.abs(primaryGroup.secondaryGroups[b].total) - Math.abs(primaryGroup.secondaryGroups[a].total)).map(secondaryCategory => {
                                    const secondaryGroup = primaryGroup.secondaryGroups[secondaryCategory];
                                    return (
                                        <AccordionItem key={secondaryCategory} value={secondaryCategory} className="border bg-slate-50/70 rounded-md">
                                            <AccordionTrigger className="px-4 py-3 text-base hover:no-underline">
                                                <div className="flex justify-between items-center w-full">
                                                    <span className="font-medium">{secondaryCategory}</span>
                                                    <span className={cn("text-base font-semibold", secondaryGroup.total >= 0 ? "text-green-600" : "text-slate-700")}>
                                                        {formatCurrency(secondaryGroup.total)}
                                                    </span>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="p-0 border-t">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>Date</TableHead>
                                                            <TableHead>Description</TableHead>
                                                            <TableHead>Subcategory</TableHead>
                                                            <TableHead className="text-right">Amount</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {secondaryGroup.transactions.map(tx => (
                                                            <TableRow key={tx.id}>
                                                                <TableCell>{new Date(tx.date).toLocaleDateString()}</TableCell>
                                                                <TableCell className="max-w-[200px] truncate">{tx.description}</TableCell>
                                                                <TableCell>
                                                                    <Badge variant="outline">{tx.subcategory}</Badge>
                                                                </TableCell>
                                                                <TableCell className={cn("text-right font-medium", tx.amount >= 0 ? 'text-green-600' : 'text-slate-800')}>
                                                                    {formatCurrency(tx.amount)}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </AccordionContent>
                                        </AccordionItem>
                                    )
                                })}
                           </Accordion>
                        </AccordionContent>
                        </Card>
                    </AccordionItem>
                )
            })}
        </Accordion>
    );
  };
  
  return (
    <div className="space-y-8 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Detailed Ledger</h1>
        <p className="text-muted-foreground">An interactive report of all transactions, grouped by category.</p>
      </div>
      {renderContent()}
    </div>
  );
}
