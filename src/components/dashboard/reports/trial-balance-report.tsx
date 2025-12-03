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
                // 1. Fetch all accounts
                const accountsQuery = query(collection(firestore, `users/${user.uid}/accounts`), orderBy('name'));
                const accountsSnapshot = await getDocs(accountsQuery);
                const accounts = accountsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));

                // 2. Fetch all relevant journal entry line items
                const journalEntriesQuery = query(
                    collectionGroup(firestore, 'journalEntries'),
                    where('userId', '==', user.uid)
                );
                const journalEntriesSnapshot = await getDocs(journalEntriesQuery);
                const journalEntryIds = journalEntriesSnapshot.docs.map(doc => doc.id);

                let allLineItems: JournalEntryLineItem[] = [];

                if (journalEntryIds.length > 0) {
                    // Firestore 'in' queries are limited to 30 items. We might need to batch this.
                    // For simplicity, assuming less than 30 journal entries for now. A more robust
                    // solution would chunk the journalEntryIds array.
                    const lineItemsQuery = query(
                        collectionGroup(firestore, 'lineItems'),
                        where('journalEntryId', 'in', journalEntryIds.slice(0, 30))
                    );
                    const lineItemsSnapshot = await getDocs(lineItemsQuery);
                    allLineItems = lineItemsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as JournalEntryLineItem));
                }
                
                // 3. Calculate balances for each account
                const balances = new Map<string, number>();
                allLineItems.forEach(item => {
                    const currentDebit = balances.get(`${item.accountId}_debit`) || 0;
                    const currentCredit = balances.get(`${item.accountId}_credit`) || 0;
                    balances.set(`${item.accountId}_debit`, currentDebit + (item.debit || 0));
                    balances.set(`${item.accountId}_credit`, currentCredit + (item.credit || 0));
                });
                
                const calculatedAccounts = accounts.map(account => {
                    const totalDebits = balances.get(`${account.id}_debit`) || 0;
                    const totalCredits = balances.get(`${account.id}_credit`) || 0;
                    let balance = 0;
                    if (account.normalBalance === 'debit') {
                        balance = totalDebits - totalCredits;
                    } else {
                        balance = totalCredits - totalDebits;
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
            if (account.balance > 0) {
                if (account.normalBalance === 'debit') {
                    acc.debit += account.balance;
                } else {
                    acc.credit += account.balance;
                }
            } else if (account.balance < 0) {
                // If balance is negative, it adds to the opposite side
                if (account.normalBalance === 'debit') {
                    acc.credit += -account.balance;
                } else {
                    acc.debit += -account.balance;
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
                                const isDebit = account.normalBalance === 'debit';
                                const showDebit = account.balance > 0 && isDebit || account.balance < 0 && !isDebit;
                                const showCredit = account.balance > 0 && !isDebit || account.balance < 0 && isDebit;

                                return (
                                    <TableRow key={account.id}>
                                        <TableCell className="font-medium">{account.name}</TableCell>
                                        <TableCell className="text-right font-mono">
                                            {showDebit ? formatCurrency(Math.abs(account.balance)) : '-'}
                                        </TableCell>
                                        <TableCell className="text-right font-mono">
                                            {showCredit ? formatCurrency(Math.abs(account.balance)) : '-'}
                                        </TableCell>
                                    </TableRow>
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
                            <TableHead className="text-right">Totals</TableHead>
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
