'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

// Mock data for demonstration
const mockJournalEntries = [
  {
    id: 'JE-001',
    date: '2024-07-01',
    description: 'To record purchase of office equipment on credit',
    lineItems: [
      { account: 'Office Equipment', debit: 8000, credit: 0 },
      { account: 'Accounts Payable', debit: 0, credit: 8000 },
    ],
  },
  {
    id: 'JE-002',
    date: '2024-07-15',
    description: 'To record owner investment',
    lineItems: [
      { account: 'Cash', debit: 10000, credit: 0 },
      { account: 'Owner\'s Equity', debit: 0, credit: 10000 },
    ],
  },
  {
    id: 'JE-003',
    date: '2024-07-20',
    description: 'To record payment of rent',
    lineItems: [
      { account: 'Rent Expense', debit: 3000, credit: 0 },
      { account: 'Cash', debit: 0, credit: 3000 },
    ],
  },
];

export function JournalEntriesReport() {
  // In a real app, you would fetch this from Firestore
  const isLoading = false;

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
                <div className="space-y-6">
                    {[...Array(2)].map((_, i) => (
                        <div key={i} className="border rounded-lg p-4 space-y-2">
                             <Skeleton className="h-5 w-1/3" />
                             <Skeleton className="h-4 w-1/2" />
                             <Skeleton className="h-16 w-full" />
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Journal Entries</CardTitle>
        <CardDescription>A detailed log of all recorded journal entries.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {mockJournalEntries.length > 0 ? (
          mockJournalEntries.map((entry) => (
            <div key={entry.id} className="border rounded-lg overflow-hidden">
                <div className="p-4 bg-muted/50">
                    <h3 className="font-semibold">{`Entry #${entry.id}`}</h3>
                    <p className="text-sm text-muted-foreground">
                        Date: {new Date(entry.date).toLocaleDateString()}
                    </p>
                    <p className="text-sm mt-1">{entry.description}</p>
                </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entry.lineItems.map((line, index) => (
                    <TableRow key={index}>
                      <TableCell>{line.account}</TableCell>
                      <TableCell className="text-right font-mono">
                        {line.debit > 0 ? formatCurrency(line.debit) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {line.credit > 0 ? formatCurrency(line.credit) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            No journal entries have been recorded yet.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
