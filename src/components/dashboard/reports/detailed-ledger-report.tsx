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

type GroupedTransactions = {
  [key: string]: {
    total: number;
    transactions: Transaction[];
  };
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
    return transactions.reduce((acc, txn) => {
      const category = txn.primaryCategory || 'Uncategorized';
      if (!acc[category]) {
        acc[category] = { total: 0, transactions: [] };
      }
      acc[category].total += txn.amount;
      acc[category].transactions.push(txn);
      return acc;
    }, {} as GroupedTransactions);
  }, [transactions]);

  const sortedCategories = useMemo(() => {
    return Object.keys(groupedData).sort((a, b) => {
      const totalA = groupedData[a].total;
      const totalB = groupedData[b].total;
      // Sort income categories first (positive totals), then expense categories (negative totals)
      if (totalA > 0 && totalB < 0) return -1;
      if (totalA < 0 && totalB > 0) return 1;
      // Within type, sort by absolute value descending
      return Math.abs(totalB) - Math.abs(totalA);
    });
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
            {sortedCategories.map((category) => {
                const { total, transactions } = groupedData[category];
                return (
                    <AccordionItem key={category} value={category} className="border-none">
                        <Card className="shadow-md">
                        <AccordionTrigger className="p-6 hover:no-underline">
                            <div className="flex justify-between items-center w-full">
                                <div className="text-left">
                                    <h3 className="text-xl font-semibold">{category}</h3>
                                    <p className="text-sm text-muted-foreground">{transactions.length} transactions</p>
                                </div>
                                <div className={cn("text-xl font-bold", total >= 0 ? "text-green-600" : "text-foreground")}>
                                    {formatCurrency(total)}
                                </div>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-6 pb-6">
                           <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Category Path</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {transactions.map((tx) => (
                                        <TableRow key={tx.id}>
                                            <TableCell>{new Date(tx.date).toLocaleDateString()}</TableCell>
                                            <TableCell>{tx.description}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{tx.secondaryCategory} &gt; {tx.subcategory}</Badge>
                                            </TableCell>
                                            <TableCell className={cn("text-right font-medium", tx.amount >= 0 ? 'text-green-600' : 'text-foreground')}>
                                                {formatCurrency(tx.amount)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                           </Table>
                        </AccordionContent>
                        </Card>
                    </AccordionItem>
                )
            })}
        </Accordion>
    );
  };
  
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Detailed Ledger</h1>
        <p className="text-muted-foreground">An interactive report of all transactions, grouped by primary category.</p>
      </div>
      {renderContent()}
    </div>
  );
}
