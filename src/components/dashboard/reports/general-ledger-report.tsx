'use client';

import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
}

interface Account {
  id: string;
  name: string;
  accountType: string;
  transactions?: Transaction[];
}

export function GeneralLedgerReport() {
  const { user } = useUser();
  const firestore = useFirestore();

  const accountsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, `users/${user.uid}/accounts`), orderBy('name'));
  }, [firestore, user]);

  const { data: accounts, isLoading: isLoadingAccounts } = useCollection<Omit<Account, 'transactions'>>(accountsQuery);

  // This is a placeholder for fetching transactions.
  // In a real app, you'd fetch transactions for each account.
  const transactions: Transaction[] = [
    { id: '1', date: '2024-07-01', description: 'Initial balance', amount: 5000 },
    { id: '2', date: '2024-07-05', description: 'Software Subscription', amount: -50 },
    { id: '3', date: '2024-07-15', description: 'Client Payment', amount: 1500 },
    { id: '4', date: '2024-07-28', description: 'Office Supplies', amount: -120 },
  ];

  const getAccountBalance = (transactions: Transaction[]) => {
    return transactions.reduce((acc, tx) => acc + tx.amount, 0);
  };
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  if (isLoadingAccounts) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-1/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
        <CardHeader>
            <CardTitle>General Ledger Details</CardTitle>
            <CardDescription>Review all transactions organized by account for the current period.</CardDescription>
        </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
            {(accounts || []).map((account) => (
                <AccordionItem value={account.id} key={account.id}>
                    <AccordionTrigger className="hover:bg-muted/50 px-4 rounded-md">
                        <div className="flex justify-between w-full pr-4">
                            <span className="font-semibold">{account.name}</span>
                            <span className={cn('font-mono', getAccountBalance(transactions) >= 0 ? 'text-green-600' : 'text-red-600')}>
                                {formatCurrency(getAccountBalance(transactions))}
                            </span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                               {transactions.map(tx => (
                                 <TableRow key={tx.id}>
                                     <TableCell>{new Date(tx.date).toLocaleDateString()}</TableCell>
                                     <TableCell>{tx.description}</TableCell>
                                     <TableCell className={cn("text-right", tx.amount > 0 ? 'text-green-600' : 'text-foreground')}>{formatCurrency(tx.amount)}</TableCell>
                                 </TableRow>
                               ))}
                            </TableBody>
                            <TableFooter>
                                <TableRow>
                                    <TableCell colSpan={2} className="text-right font-bold">Ending Balance</TableCell>
                                    <TableCell className={cn("text-right font-bold", getAccountBalance(transactions) >= 0 ? 'text-green-600' : 'text-red-600')}>{formatCurrency(getAccountBalance(transactions))}</TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </AccordionContent>
                </AccordionItem>
            ))}
            {accounts?.length === 0 && <p className="p-4 text-center text-muted-foreground">No accounts found. Create accounts to see the General Ledger.</p>}
        </Accordion>
      </CardContent>
    </Card>
  );
}
