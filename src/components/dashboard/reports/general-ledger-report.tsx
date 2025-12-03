'use client';

import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, getDocs, where, CollectionReference } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

// Represents a line item combined with its parent journal entry's data
interface LedgerEntry {
  id: string;
  journalEntryId: string;
  date: string;
  description: string;
  debit: number;
  credit: number;
}

interface Account {
  id: string;
  name: string;
  accountType: string;
  normalBalance: 'debit' | 'credit';
  // Ledger entries will be populated after fetching
  ledgerEntries?: LedgerEntry[];
}

// A component to render the details for a single account
function AccountLedger({ account }: { account: Account }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [isLoadingEntries, setIsLoadingEntries] = useState(true);

  useEffect(() => {
    const fetchLedgerEntries = async () => {
      if (!user || !firestore) return;
      setIsLoadingEntries(true);

      const allEntries: LedgerEntry[] = [];
      const fiscalYearsSnapshot = await getDocs(collection(firestore, `users/${user.uid}/fiscalYears`));

      // Loop through all fiscal years
      for (const fiscalYearDoc of fiscalYearsSnapshot.docs) {
        const journalEntriesSnapshot = await getDocs(collection(fiscalYearDoc.ref, 'journalEntries'));
        
        // Loop through all journal entries in that year
        for (const journalEntryDoc of journalEntriesSnapshot.docs) {
          // Query for line items in this journal entry that match the account ID
          const lineItemsQuery = query(
            collection(journalEntryDoc.ref, 'lineItems'),
            where('accountId', '==', account.id)
          );
          const lineItemsSnapshot = await getDocs(lineItemsQuery);

          if (!lineItemsSnapshot.empty) {
            const journalEntryData = journalEntryDoc.data();
            lineItemsSnapshot.forEach(lineItemDoc => {
              const lineItemData = lineItemDoc.data();
              allEntries.push({
                id: lineItemDoc.id,
                journalEntryId: journalEntryDoc.id,
                date: journalEntryData.date,
                description: journalEntryData.description,
                debit: lineItemData.debit || 0,
                credit: lineItemData.credit || 0,
              });
            });
          }
        }
      }

      // Sort entries by date
      allEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      setEntries(allEntries);
      setIsLoadingEntries(false);
    };

    fetchLedgerEntries();
  }, [user, firestore, account.id]);
  
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

  if (isLoadingEntries) {
    return (
        <div className="p-4">
            <Skeleton className="h-24 w-full" />
        </div>
    );
  }

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
                    <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
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

  const accountsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, `users/${user.uid}/accounts`), orderBy('name'));
  }, [firestore, user]);

  const { data: accounts, isLoading: isLoadingAccounts } = useCollection<Account>(accountsQuery);


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
               <AccountLedger key={account.id} account={account} />
            ))}
            {accounts?.length === 0 && <p className="p-4 text-center text-muted-foreground">No accounts found. Create accounts to see the General Ledger.</p>}
        </Accordion>
      </CardContent>
    </Card>
  );
}