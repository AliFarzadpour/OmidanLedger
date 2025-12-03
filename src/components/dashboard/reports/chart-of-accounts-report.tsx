'use client';

import { useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collectionGroup, query, where } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

// This interface represents a transaction, which is where categories are stored.
interface Transaction {
  id: string;
  primaryCategory: string;
  secondaryCategory: string;
  subcategory: string;
}

// This represents a unique account in our derived Chart of Accounts.
interface Account {
  id: string;
  primary: string;
  secondary: string;
  sub: string;
}

export function ChartOfAccountsReport() {
  const { user } = useUser();
  const firestore = useFirestore();

  // We perform a collectionGroup query to get all transactions for the user.
  const transactionsQuery = useMemoFirebase(() => {
    if (!user || !firestore) {
      return null;
    }
    return query(collectionGroup(firestore, 'transactions'), where('userId', '==', user.uid));
  }, [user, firestore]);

  const { data: transactions, isLoading } = useCollection<Transaction>(transactionsQuery);

  // We derive the unique accounts from the transaction data.
  const accounts = useMemo((): Account[] => {
    if (!transactions) return [];
    
    const uniqueAccounts = new Map<string, Account>();

    transactions.forEach(tx => {
      // Ensure all category levels exist to prevent errors
      if (tx.primaryCategory && tx.secondaryCategory && tx.subcategory) {
        const key = `${tx.primaryCategory}-${tx.secondaryCategory}-${tx.subcategory}`;
        if (!uniqueAccounts.has(key)) {
          uniqueAccounts.set(key, {
            id: key,
            primary: tx.primaryCategory,
            secondary: tx.secondaryCategory,
            sub: tx.subcategory,
          });
        }
      }
    });

    // Sort the accounts for consistent display
    return Array.from(uniqueAccounts.values()).sort((a, b) => a.id.localeCompare(b.id));
  }, [transactions]);

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Chart of Accounts</h1>
            <p className="text-muted-foreground">A list of all categories used to classify your transactions.</p>
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-1/4" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!accounts || accounts.length === 0) {
    return (
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Chart of Accounts</h1>
        <p className="text-muted-foreground">A list of all categories used to classify your transactions.</p>
        <Card className="mt-8">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No categories found. Once you have categorized transactions, your Chart of Accounts will appear here.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Chart of Accounts</h1>
        <p className="text-muted-foreground">A list of all categories derived from your transactions.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Primary Category</TableHead>
                        <TableHead>Secondary Category</TableHead>
                        <TableHead>Subcategory</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {accounts.map((account) => (
                        <TableRow key={account.id}>
                            <TableCell className="font-medium">{account.primary}</TableCell>
                            <TableCell>{account.secondary}</TableCell>
                            <TableCell>{account.sub}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </CardContent>
      </Card>
    </div>
  );
}
