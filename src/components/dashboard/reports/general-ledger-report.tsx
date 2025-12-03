'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUser, useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { collection, getDocs, query, orderBy, collectionGroup, where } from 'firebase/firestore';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// Types matching the database structure
interface BankAccount {
  id: string;
  accountName: string;
  bankName: string;
}

interface Transaction {
  id: string;
  date: string; // Assuming date is a string like 'YYYY-MM-DD'
  description: string;
  amount: number;
  bankAccountId: string;
}

interface LedgerData {
  account: BankAccount;
  transactions: Transaction[];
}

export function GeneralLedgerReport() {
  const { user } = useUser();
  const firestore = useFirestore();

  const accountsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(firestore, `users/${user.uid}/bankAccounts`);
  }, [user, firestore]);
  const { data: accounts, isLoading: isLoadingAccounts } = useCollection<BankAccount>(accountsQuery);

  const transactionsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collectionGroup(firestore, 'transactions'),
      where('userId', '==', user.uid),
      orderBy('date', 'asc')
    );
  }, [user, firestore]);
  const { data: transactions, isLoading: isLoadingTransactions } = useCollection<Transaction>(transactionsQuery);

  const ledgerData = useMemo((): LedgerData[] => {
    if (!accounts || !transactions) return [];

    return accounts.map(account => {
      const accountTransactions = transactions.filter(tx => tx.bankAccountId === account.id);
      return { account, transactions: accountTransactions };
    });
  }, [accounts, transactions]);
  
  const isLoading = isLoadingAccounts || isLoadingTransactions;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-6 w-1/2" />
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-1/4" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (ledgerData.length === 0) {
    return (
      <div>
        <h1 className="text-3xl font-bold tracking-tight">General Ledger</h1>
        <p className="text-muted-foreground">A detailed history of all transactions, grouped by account.</p>
        <Card className="mt-8">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No bank accounts found. Please add a data source on the Transactions page to see the General Ledger.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">General Ledger</h1>
        <p className="text-muted-foreground">A detailed history of all transactions, grouped by account.</p>
      </div>

      <Accordion type="multiple" className="w-full space-y-4">
        {ledgerData.map(({ account, transactions }) => (
          <AccountLedger key={account.id} account={account} transactions={transactions} />
        ))}
      </Accordion>
    </div>
  );
}

function AccountLedger({ account, transactions }: LedgerData) {
    let runningBalance = 0;
  
    return (
      <AccordionItem value={account.id} className="border-none">
        <Card className="shadow-md">
          <AccordionTrigger className="p-6 hover:no-underline">
            <div className="flex justify-between items-center w-full">
              <div className="text-left">
                <h3 className="text-xl font-semibold">{account.accountName}</h3>
                <p className="text-sm text-muted-foreground">{account.bankName}</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            {transactions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => {
                    runningBalance += tx.amount;
                    return (
                      <TableRow key={tx.id}>
                        <TableCell>{new Date(tx.date).toLocaleDateString()}</TableCell>
                        <TableCell>{tx.description}</TableCell>
                        <TableCell
                          className={cn(
                            'text-right font-medium',
                            tx.amount >= 0 ? 'text-green-600' : 'text-foreground'
                          )}
                        >
                          {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: 'USD',
                          }).format(tx.amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: 'USD',
                          }).format(runningBalance)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-muted-foreground py-4">No transactions found for this account.</p>
            )}
          </AccordionContent>
        </Card>
      </AccordionItem>
    );
  }
