'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
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
}

interface LedgerData {
  account: BankAccount;
  transactions: Transaction[];
}

export function GeneralLedgerReport() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [ledgerData, setLedgerData] = useState<LedgerData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // CRITICAL: Wait for both user and firestore to be available.
    if (!user || !firestore) {
      // If we are not in an initial loading state, it means there's no user.
      if (!isUserLoading) {
        setIsLoading(false);
      }
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      try {
        // 1. Fetch all bank accounts
        const accountsRef = collection(firestore, `users/${user.uid}/bankAccounts`);
        const accountsSnapshot = await getDocs(accountsRef);
        const accounts = accountsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as BankAccount[];

        if (accounts.length === 0) {
            setLedgerData([]);
            setIsLoading(false);
            return;
        }

        // 2. Fetch transactions for each account
        const allLedgerData: LedgerData[] = await Promise.all(
          accounts.map(async (account) => {
            const transactionsQuery = query(
              collection(firestore, `users/${user.uid}/bankAccounts/${account.id}/transactions`),
              orderBy('date', 'asc')
            );
            const transactionsSnapshot = await getDocs(transactionsQuery);
            const transactions = transactionsSnapshot.docs.map(doc => {
              const data = doc.data();
              return {
                id: doc.id,
                // Ensure date is a string. If it's a Firestore Timestamp, convert it.
                date: data.date?.toDate ? data.date.toDate().toISOString().split('T')[0] : data.date,
                description: data.description,
                amount: data.amount,
              };
            }) as Transaction[];

            return { account, transactions };
          })
        );

        setLedgerData(allLedgerData);
      } catch (error) {
        console.error("Error fetching general ledger data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user, firestore, isUserLoading]);

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
