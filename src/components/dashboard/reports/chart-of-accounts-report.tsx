'use client';

import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

interface Account {
  id: string;
  name: string;
  accountType: string;
  normalBalance: 'debit' | 'credit';
  description?: string;
}

export function ChartOfAccountsReport() {
  const { user } = useUser();
  const firestore = useFirestore();

  const accountsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, `users/${user.uid}/accounts`), orderBy('accountType'), orderBy('name'));
  }, [firestore, user]);

  const { data: accounts, isLoading } = useCollection<Account>(accountsQuery);

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
                            <TableHead><Skeleton className="h-5 w-24" /></TableHead>
                            <TableHead><Skeleton className="h-5 w-32" /></TableHead>
                            <TableHead><Skeleton className="h-5 w-20" /></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {[...Array(5)].map((_, i) => (
                            <TableRow key={i}>
                                <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-full" /></TableCell>
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
            <CardTitle>Chart of Accounts</CardTitle>
            <CardDescription>A list of all accounts used in the bookkeeping system.</CardDescription>
        </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account Name</TableHead>
              <TableHead>Account Type</TableHead>
              <TableHead>Normal Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts && accounts.length > 0 ? (
              accounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell className="font-medium">{account.name}</TableCell>
                  <TableCell>{account.accountType}</TableCell>
                  <TableCell className="capitalize">{account.normalBalance}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center">
                  No accounts found. Add accounts to see your Chart of Accounts.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
