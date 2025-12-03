'use client';

import { useUser, useFirestore } from '@/firebase';
import { collection, query, orderBy, getDocs, Timestamp, collectionGroup, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useEffect, useState, useMemo } from 'react';

// Represents a line item combined with its parent journal entry's data
interface LedgerEntry {
  id: string;
  journalEntryId: string;
  accountId: string;
  date: Date; // Use Date object
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
    accountId: string;
    debit: number;
    credit: number;
}

// A component to render the details for a single account
function AccountLedger({ account, allLedgerEntries }: { account: Account, allLedgerEntries: LedgerEntry[] }) {
  const entries = useMemo(() => {
    return allLedgerEntries.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [allLedgerEntries]);
  
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
  const balance = calculateBalance(entries, account.normalBalance);

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
        {entries.length > 0 ? (
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
              {entries.map((entry) => {
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
        // Step 1: Fetch all accounts
        const accountsQuery = query(collection(firestore, `users/${user.uid}/accounts`), orderBy('name'));
        const accountsSnapshot = await getDocs(accountsQuery);
        const fetchedAccounts = accountsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
        setAccounts(fetchedAccounts);

        // Step 2: Fetch all journal entries for the user using a collectionGroup query
        const journalEntriesQuery = query(
            collectionGroup(firestore, 'journalEntries'),
            where('userId', '==', user.uid)
        );
        const journalEntriesSnapshot = await getDocs(journalEntriesQuery);
        const journalEntriesMap = new Map<string, JournalEntry>();
        journalEntriesSnapshot.docs.forEach(doc => {
            journalEntriesMap.set(doc.id, { id: doc.id, ...doc.data() } as JournalEntry);
        });

        // Step 3: Fetch all line items for the user
        const lineItemsQuery = query(collectionGroup(firestore, 'lineItems'));
        const lineItemsSnapshot = await getDocs(lineItemsQuery);
        const allLedgerEntries: LedgerEntry[] = [];
        
        lineItemsSnapshot.forEach(doc => {
            // Because lineItems is nested, we get its parent journal entry's ID
            const journalEntryId = doc.ref.parent.parent?.id;

            if (journalEntryId && journalEntriesMap.has(journalEntryId)) {
                const lineItemData = doc.data() as JournalEntryLineItem;
                const journalEntry = journalEntriesMap.get(journalEntryId)!;

                allLedgerEntries.push({
                    id: doc.id,
                    journalEntryId: journalEntry.id,
                    accountId: lineItemData.accountId,
                    date: journalEntry.date.toDate(),
                    description: journalEntry.description,
                    debit: lineItemData.debit || 0,
                    credit: lineItemData.credit || 0,
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
    // Initialize map for all accounts to ensure every account is rendered
    for (const account of accounts) {
        map.set(account.id, []);
    }
    // Distribute ledger entries into the map
    for (const entry of ledgerEntries) {
      if(map.has(entry.accountId)) {
        map.get(entry.accountId)?.push(entry);
      }
    }
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
                        allLedgerEntries={ledgerEntriesByAccount.get(account.id) || []}
                    />
                ))
            ) : (
                <div className="text-center py-10">
                    <p className="text-muted-foreground">No accounts found. Create accounts to see the General Ledger.</p>
                </div>
            )}
        </Accordion>
      </CardContent>
    </Card>
  );
}
