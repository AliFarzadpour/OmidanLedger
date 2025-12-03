'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

// Mock data - in a real app, this would come from Firestore
const mockAccounts = [
  { id: '1', name: 'Cash', debit: 15000, credit: 0 },
  { id: '2', name: 'Accounts Receivable', debit: 5000, credit: 0 },
  { id: '3', name: 'Office Equipment', debit: 8000, credit: 0 },
  { id: '4', name: 'Accounts Payable', debit: 0, credit: 4000 },
  { id: '5', name: 'Owner\'s Equity', debit: 0, credit: 20000 },
  { id: '6', name: 'Service Revenue', debit: 0, credit: 10000 },
  { id: '7', name: 'Rent Expense', debit: 3000, credit: 0 },
  { id: '8', name: 'Utilities Expense', debit: 3000, credit: 0 },
];

export function TrialBalanceReport() {
  // In a real app, you'd use a hook to fetch and calculate this data.
  const isLoading = false; 

  const totals = mockAccounts.reduce(
    (acc, account) => {
      acc.debit += account.debit;
      acc.credit += account.credit;
      return acc;
    },
    { debit: 0, credit: 0 }
  );

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
            {mockAccounts.map((account) => (
              <TableRow key={account.id}>
                <TableCell className="font-medium">{account.name}</TableCell>
                <TableCell className="text-right font-mono">{account.debit > 0 ? formatCurrency(account.debit) : '-'}</TableCell>
                <TableCell className="text-right font-mono">{account.credit > 0 ? formatCurrency(account.credit) : '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow className="bg-muted/50">
              <TableHead className="text-right">Totals</TableHead>
              <TableHead className="text-right font-bold font-mono">{formatCurrency(totals.debit)}</TableHead>
              <TableHead className="text-right font-bold font-mono">{formatCurrency(totals.credit)}</TableHead>
            </TableRow>
             {totals.debit !== totals.credit && (
                <TableRow>
                    <TableCell colSpan={3} className="text-center text-destructive font-semibold">
                        Warning: Debits and Credits do not match.
                    </TableCell>
                </TableRow>
             )}
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  );
}
