'use client';

import { useUser, useFirestore } from '@/firebase';
import { collection, query, orderBy, getDocs, collectionGroup, where, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useEffect, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';

interface Account {
  id: string;
  name: string;
  accountType: string;
  normalBalance: 'debit' | 'credit';
}

interface JournalEntryLineItem {
    id: string;
    accountId: string;
    debit: number;
    credit: number;
    userId: string;
}

interface AccountWithBalance extends Account {
    balance: number;
}

export function TrialBalanceReport() {
    const { user } = useUser();
    const firestore = useFirestore();
    const [accountsWithBalances, setAccountsWithBalances] = useState<AccountWithBalance[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            if (!user || !firestore) return;
            setIsLoading(true);

            try {
                // 1. Fetch all accounts for the current user
                const accountsQuery = query(collection(firestore, `users/${user.uid}/accounts`), orderBy('name'));
                const accountsSnapshot = await getDocs(accountsQuery);
                const accounts = accountsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));

                if (accounts.length === 0) {
                    setAccountsWithBalances([]);
                    setIsLoading(false);
                    return;
                }

                // 2. Fetch all line items for the user in a single collectionGroup query
                const lineItemsQuery = query(
                    collectionGroup(firestore, 'lineItems'),
                    where('userId', '==', user.uid)
                );
                const lineItemsSnapshot = await getDocs(lineItemsQuery);
                const allLineItems = lineItemsSnapshot.docs.map(doc => doc.data() as JournalEntryLineItem);

                // 3. Calculate balances for each account
                const balances = new Map<string, { debit: number; credit: number }>();

                // Initialize balances for all accounts to zero
                accounts.forEach(account => {
                    balances.set(account.id, { debit: 0, credit: 0 });
                });

                // Aggregate debits and credits from line items
                allLineItems.forEach(item => {
                    if (balances.has(item.accountId)) {
                        const current = balances.get(item.accountId)!;
                        current.debit += item.debit || 0;
                        current.credit += item.credit || 0;
                    }
                });

                // 4. Determine final balance for each account based on normal balance
                const calculatedAccounts = accounts.map(account => {
                    const { debit, credit } = balances.get(account.id)!;
                    let balance = 0;
                    if (account.normalBalance === 'debit') {
                        balance = debit - credit;
                    } else {
                        balance = credit - debit;
                    }
                    return { ...account, balance };
                });
                
                setAccountsWithBalances(calculatedAccounts);

            } catch (error) {
                console.error("Error fetching trial balance data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [user, firestore]);

    const totals = useMemo(() => {
        return accountsWithBalances.reduce(
          (acc, account) => {
            if (account.balance >= 0) {
                if (account.normalBalance === 'debit') {
                    acc.debit += account.balance;
                } else {
                    acc.credit += account.balance;
                }
            } else { // Negative balance appears on the opposite side
                if (account.normalBalance === 'debit') {
                    acc.credit += Math.abs(account.balance);
                } else {
                    acc.debit += Math.abs(account.balance);
                }
            }
            return acc;
          },
          { debit: 0, credit: 0 }
        );
    }, [accountsWithBalances]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    if (isLoading) {
        return (
           <Card>
               <CardHeader>
                   <Skeleton className="h-6 w-1/4" />
                   <Skeleton className="h-4 w-1/2" />
               </CardHeader>
               <CardContent>
                   <Table>
                       <TableHeader>
                           <TableRow>
                               <TableHead><Skeleton className="h-5 w-32" /></TableHead>
                               <TableHead className="text-right"><Skeleton className="h-5 w-24 ml-auto" /></TableHead>
                               <TableHead className="text-right"><Skeleton className="h-5 w-24 ml-auto" /></TableHead>
                           </TableRow>
                       </TableHeader>
                       <TableBody>
                           {[...Array(5)].map((_, i) => (
                               <TableRow key={i}>
                                   <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                                   <TableCell><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                                   <TableCell><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                               </TableRow>
                           ))}
                       </TableBody>
                   </Table>
               </CardContent>
           </Card>
       );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Trial Balance</CardTitle>
                <CardDescription>As of {new Date().toLocaleDateString()}</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Account</TableHead>
                            <TableHead className="text-right">Debit</TableHead>
                            <TableHead className="text-right">Credit</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {accountsWithBalances.length > 0 ? (
                            accountsWithBalances.map((account) => {
                                const isDebitNormal = account.normalBalance === 'debit';
                                let debitAmount = 0;
                                let creditAmount = 0;

                                if (account.balance >= 0) {
                                    if(isDebitNormal) debitAmount = account.balance;
                                    else creditAmount = account.balance;
                                } else {
                                    if(isDebitNormal) creditAmount = Math.abs(account.balance);
                                    else debitAmount = Math.abs(account.balance);
                                }


                                return (
                                    (debitAmount > 0 || creditAmount > 0) && (
                                        <TableRow key={account.id}>
                                            <TableCell className="font-medium">{account.name}</TableCell>
                                            <TableCell className="text-right font-mono">
                                                {debitAmount > 0 ? formatCurrency(debitAmount) : '-'}
                                            </TableCell>
                                            <TableCell className="text-right font-mono">
                                                {creditAmount > 0 ? formatCurrency(creditAmount) : '-'}
                                            </TableCell>
                                        </TableRow>
                                    )
                                );
                            })
                        ) : (
                            <TableRow>
                                <TableCell colSpan={3} className="h-24 text-center">
                                    No accounts found. Add accounts and journal entries to see your Trial Balance.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                    <TableFooter>
                        <TableRow className="bg-muted/50">
                            <TableHead className="text-right font-bold">Totals</TableHead>
                            <TableHead className="text-right font-bold font-mono">{formatCurrency(totals.debit)}</TableHead>
                            <TableHead className={cn("text-right font-bold font-mono", totals.debit !== totals.credit && "text-destructive")}>{formatCurrency(totals.credit)}</TableHead>
                        </TableRow>
                        {totals.debit !== totals.credit && (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center text-destructive font-semibold p-2">
                                    Warning: Total debits do not equal total credits. Your books are out of balance.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableFooter>
                </Table>
            </CardContent>
        </Card>
    );
}

    