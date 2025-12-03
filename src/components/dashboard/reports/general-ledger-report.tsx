'use client';

import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, getDocs, Timestamp, where } from 'firebase/firestore';
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
}

interface JournalEntry {
    id: string;
    date: Timestamp;
    description: string;
    lineItems: JournalEntryLineItem[];
}


// A component to render the details for a single account
function AccountLedger({ account, allLedgerEntries }: { account: Account, allLedgerEntries: LedgerEntry[] }) {
    const [entries, setEntries] = useState<LedgerEntry[]>([]);

    useEffect(() => {
        // Filter the pre-fetched entries for the current account
        const accountEntries = allLedgerEntries
            .filter(entry => {
                // This filtering is tricky because a line item only has the accountId,
                // but the ledger entry is built from the journal entry. 
                // We'll assume for now that if we got here, it's the right account.
                // The filtering should happen at a higher level.
                // For now, we will re-filter based on the journal entries the line items came from.
                // This is a bit of a workaround because we don't have accountId directly on LedgerEntry.
                // A better data model would help.
                return true; // We'll rely on the parent component's filtering.
            })
            .sort((a, b) => a.date.getTime() - b.date.getTime());
        
        // This is a placeholder for a more complex filtering logic if needed.
        // The parent now provides the correct entries.
        const filteredEntries = allLedgerEntries.sort((a, b) => a.date.getTime() - b.date.getTime());
        setEntries(filteredEntries);

    }, [allLedgerEntries, account.id]);
  
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
          <span className={cn('font-mono', balance >= 0 ? 'text-green-600' : 'text-red-600')}>
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
                <TableCell className={cn("text-right font-bold font-mono", balance >= 0 ? 'text-green-600' : 'text-red-600')}>
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
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [isLoadingEntries, setIsLoadingEntries] = useState(true);

  const accountsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, `users/${user.uid}/accounts`), orderBy('name'));
  }, [firestore, user]);

  const { data: accounts, isLoading: isLoadingAccounts } = useCollection<Account>(accountsQuery);

  useEffect(() => {
    const fetchAllJournalEntries = async () => {
        if (!user || !firestore) return;
        setIsLoadingEntries(true);
        const allJournalEntries: JournalEntry[] = [];
        const fiscalYearsSnapshot = await getDocs(collection(firestore, `users/${user.uid}/fiscalYears`));

        for (const fiscalYearDoc of fiscalYearsSnapshot.docs) {
            const journalEntriesSnapshot = await getDocs(collection(fiscalYearDoc.ref, 'journalEntries'));
            for (const journalEntryDoc of journalEntriesSnapshot.docs) {
                const lineItemsSnapshot = await getDocs(collection(journalEntryDoc.ref, 'lineItems'));
                const lineItems = lineItemsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as JournalEntryLineItem));
                
                const journalEntryData = journalEntryDoc.data();
                allJournalEntries.push({
                    id: journalEntryDoc.id,
                    date: journalEntryData.date,
                    description: journalEntryData.description,
                    lineItems: lineItems,
                });
            }
        }
        setJournalEntries(allJournalEntries);
        setIsLoadingEntries(false);
    };
    fetchAllJournalEntries();
  }, [user, firestore]);

  const ledgerEntriesByAccount = useMemo(() => {
    const map = new Map<string, LedgerEntry[]>();
    if (!accounts || !journalEntries) return map;

    for (const account of accounts) {
        map.set(account.id, []);
    }
    
    for (const je of journalEntries) {
        for (const li of je.lineItems) {
            if (map.has(li.accountId)) {
                map.get(li.accountId)!.push({
                    id: li.id,
                    journalEntryId: je.id,
                    // Correctly convert Firestore Timestamp to JS Date
                    date: je.date.toDate(), 
                    description: je.description,
                    debit: li.debit || 0,
                    credit: li.credit || 0,
                });
            }
        }
    }
    return map;
  }, [accounts, journalEntries]);

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
            {(accounts || []).map((account) => (
               <AccountLedger 
                    key={account.id} 
                    account={account} 
                    allLedgerEntries={ledgerEntriesByAccount.get(account.id) || []}
                />
            ))}
            {accounts?.length === 0 && <p className="p-4 text-center text-muted-foreground">No accounts found. Create accounts to see the General Ledger.</p>}
        </Accordion>
      </CardContent>
    </Card>
  );
}