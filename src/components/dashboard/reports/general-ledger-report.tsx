'use client';

import { useUser, useFirestore } from '@/firebase';
import { collection, query, orderBy, getDocs, Timestamp, collectionGroup, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useEffect, useState, useMemo } from 'react';

interface LedgerEntry {
  id: string;
  journalEntryId: string;
  accountId: string;
  date: Date;
  description: string;
  debit: number;
  credit: number;
}

interface Account {
  id: string;
  name: string;
  accountType: string;
  normalBalance: 'debit' | 'credit';
}

interface JournalEntry {
    id: string;
    date: Timestamp;
    description: string;
    userId: string;
}

interface JournalEntryLineItem {
    id: string;
    journalEntryId: string;
    accountId: string;
    debit: number;
    credit: number;
    userId: string;
}

function AccountLedger({ account, entries }: { account: Account, entries: LedgerEntry[] }) {
  const sortedEntries = useMemo(() => {
    return entries.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [entries]);
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const calculateBalance = (entries: LedgerEntry[], normalBalance: 'debit' | 'credit') => {
    return entries.reduce((acc, entry) => {
      if (normalBalance === 'debit') {
        return acc + entry.debit - entry.credit;
      }
      return acc + entry.credit - entry.debit;
    }, 0);
  };

  let runningBalance = 0;
  const balance = calculateBalance(sortedEntries, account.normalBalance);

  return (
    <AccordionItem value={account.id} key={account.id}>
      <AccordionTrigger className="hover:bg-muted/50 px-4 rounded-md">
        <div className="flex justify-between w-full pr-4">
          <span className="font-semibold">{account.name}</span>
          <span className={cn('font-mono', balance >= 0 ? 'text-foreground' : 'text-destructive')}>
            {formatCurrency(balance)}
          </span>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        {sortedEntries.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedEntries.map((entry) => {
                if (account.normalBalance === 'debit') {
                    runningBalance += entry.debit - entry.credit;
                } else {
                    runningBalance += entry.credit - entry.debit;
                }
                return (
                  <TableRow key={entry.id}>
                    <TableCell>{entry.date.toLocaleDateString()}</TableCell>
                    <TableCell>{entry.description}</TableCell>
                    <TableCell className="text-right font-mono">{entry.debit > 0 ? formatCurrency(entry.debit) : '-'}</TableCell>
                    <TableCell className="text-right font-mono">{entry.credit > 0 ? formatCurrency(entry.credit) : '-'}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(runningBalance)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4} className="text-right font-bold">Ending Balance</TableCell>
                <TableCell className={cn("text-right font-bold font-mono", balance >= 0 ? 'text-foreground' : 'text-destructive')}>
                  {formatCurrency(balance)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        ) : (
          <p className="p-4 text-center text-muted-foreground">No transactions for this account.</p>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}


export function GeneralLedgerReport() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAllData = async () => {
      if (!user || !firestore) return;
      setIsLoading(true);
      
      try {
        const accountsQuery = query(collection(firestore, `users/${user.uid}/accounts`), orderBy('name'));
        const journalEntriesQuery = query(collectionGroup(firestore, 'journalEntries'), where('userId', '==', user.uid));
        const lineItemsQuery = query(collectionGroup(firestore, 'lineItems'), where('userId', '==', user.uid));

        const [accountsSnapshot, journalEntriesSnapshot, lineItemsSnapshot] = await Promise.all([
            getDocs(accountsQuery),
            getDocs(journalEntriesQuery),
            getDocs(lineItemsQuery)
        ]);

        const fetchedAccounts = accountsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
        setAccounts(fetchedAccounts);

        const journalEntriesMap = new Map<string, JournalEntry>();
        journalEntriesSnapshot.docs.forEach(doc => {
            journalEntriesMap.set(doc.id, { id: doc.id, ...doc.data() } as JournalEntry);
        });

        const allLineItems = lineItemsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as JournalEntryLineItem));

        const allLedgerEntries: LedgerEntry[] = [];
        allLineItems.forEach(lineItem => {
            const journalEntry = journalEntriesMap.get(lineItem.journalEntryId);
            if (journalEntry) {
                allLedgerEntries.push({
                    id: lineItem.id,
                    journalEntryId: journalEntry.id,
                    accountId: lineItem.accountId,
                    date: journalEntry.date.toDate(),
                    description: journalEntry.description,
                    debit: lineItem.debit || 0,
                    credit: lineItem.credit || 0,
                });
            }
        });
        
        setLedgerEntries(allLedgerEntries);

      } catch (error) {
          console.error("Error fetching general ledger data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllData();
  }, [user, firestore]);

  const ledgerEntriesByAccount = useMemo(() => {
    const map = new Map<string, LedgerEntry[]>();
    accounts.forEach(account => map.set(account.id, []));
    ledgerEntries.forEach(entry => {
      if (map.has(entry.accountId)) {
        map.get(entry.accountId)!.push(entry);
      }
    });
    return map;
  }, [accounts, ledgerEntries]);

  if (isLoading) {
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
        <Accordion type="multiple" className="w-full">
            {(accounts && accounts.length > 0) ? (
                accounts.map((account) => (
                   <AccountLedger 
                        key={account.id} 
                        account={account} 
                        entries={ledgerEntriesByAccount.get(account.id) || []}
                    />
                ))
            ) : (
                <div className="text-center py-10">
                    <p className="text-muted-foreground">No accounts found. Create accounts and journal entries to see the General Ledger.</p>
                </div>
            )}
        </Accordion>
      </CardContent>
    </Card>
  );
}

    