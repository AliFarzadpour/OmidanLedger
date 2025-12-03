'use client';

import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, getDocs, Timestamp, getDoc, collectionGroup } from 'firebase/firestore';
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

interface JournalEntryLineItem {
    id: string;
    accountId: string;
    debit: number;
    credit: number;
    parent: any; // Reference to the parent JournalEntry document
}

interface JournalEntry {
    id: string;
    date: Timestamp;
    description: string;
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
              {entries.map((entry, index) => {
                const runningBalance = calculateBalance(entries.slice(0, index + 1), account.normalBalance);
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
  const [isLoadingEntries, setIsLoadingEntries] = useState(true);

  const accountsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, `users/${user.uid}/accounts`), orderBy('name'));
  }, [firestore, user]);

  const { data: accounts, isLoading: isLoadingAccounts } = useCollection<Account>(accountsQuery);

  useEffect(() => {
    const fetchLedgerEntries = async () => {
      if (!user || !firestore) return;
      setIsLoadingEntries(true);
      const allEntries: LedgerEntry[] = [];
      
      try {
        const lineItemsQuery = query(collectionGroup(firestore, 'lineItems'));
        const lineItemsSnapshot = await getDocs(lineItemsQuery);

        for (const lineItemDoc of lineItemsSnapshot.docs) {
          const lineItemData = lineItemDoc.data() as JournalEntryLineItem;
          
          // Ensure the line item belongs to the current user by checking the path
          if (lineItemDoc.ref.path.startsWith(`users/${user.uid}/`)) {
            const journalEntryRef = lineItemDoc.ref.parent.parent;
            if (journalEntryRef) {
              const journalEntrySnap = await getDoc(journalEntryRef);
              if (journalEntrySnap.exists()) {
                const journalEntryData = journalEntrySnap.data() as JournalEntry;
                allEntries.push({
                  id: lineItemDoc.id,
                  journalEntryId: journalEntryRef.id,
                  accountId: lineItemData.accountId,
                  date: journalEntryData.date.toDate(),
                  description: journalEntryData.description,
                  debit: lineItemData.debit || 0,
                  credit: lineItemData.credit || 0,
                } as LedgerEntry & { accountId: string });
              }
            }
          }
        }
        setLedgerEntries(allEntries);
      } catch (error) {
          console.error("Error fetching ledger entries:", error);
      } finally {
        setIsLoadingEntries(false);
      }
    };

    fetchLedgerEntries();
  }, [user, firestore]);

  const ledgerEntriesByAccount = useMemo(() => {
    const map = new Map<string, LedgerEntry[]>();
    if (!accounts || ledgerEntries.length === 0) return map;

    // Initialize map for all accounts
    for (const account of accounts) {
        map.set(account.id, []);
    }
    
    // Distribute ledger entries into the map
    for (const entry of ledgerEntries) {
      const accountEntries = map.get((entry as any).accountId);
      if (accountEntries) {
          accountEntries.push(entry);
      }
    }
    return map;
  }, [accounts, ledgerEntries]);

  const isLoading = isLoadingAccounts || isLoadingEntries;

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
        <Accordion type="single" collapsible className="w-full">
            {(accounts && accounts.length > 0) ? (
                accounts.map((account) => (
                   <AccountLedger 
                        key={account.id} 
                        account={account} 
                        allLedgerEntries={ledgerEntriesByAccount.get(account.id) || []}
                    />
                ))
            ) : (
                <p className="p-4 text-center text-muted-foreground">No accounts found. Create accounts to see the General Ledger.</p>
            )}
        </Accordion>
      </CardContent>
    </Card>
  );
}