
'use client';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Skeleton } from '../ui/skeleton';

const primaryCategoryColors: Record<string, string> = {
  'INCOME': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  'COST OF GOODS SOLD': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  'EXPENSE': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  'OPERATING EXPENSE': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  'BALANCE SHEET': 'bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  'EQUITY': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
  'LIABILITY': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  'ASSET': 'bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  'UNCATEGORIZED': 'bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
};

interface Transaction {
    id: string;
    date: string;
    description: string;
    categoryHierarchy?: { l0: string };
    primaryCategory?: string; // Fallback
    amount: number;
    bankAccountId?: string; 
}

interface RecentTransactionsProps {
    transactions: Transaction[];
    isLoading?: boolean;
}

export function RecentTransactions({ transactions, isLoading }: RecentTransactionsProps) {
  const recentTransactions = transactions.slice(0, 5); // Show first 5 for summary

  return (
    <Card className="h-full shadow-lg">
      <CardHeader>
        <CardTitle>Recent Transactions</CardTitle>
        <CardDescription>
          Here are your most recent transactions for the selected period.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                 [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                        <TableCell colSpan={3}>
                            <Skeleton className="h-5 w-full" />
                        </TableCell>
                    </TableRow>
                 ))
            ) : recentTransactions.length > 0 ? (
              recentTransactions.map((transaction, index) => {
                const category = (transaction.categoryHierarchy?.l0 || transaction.primaryCategory || 'Uncategorized').toUpperCase();
                return (
                <TableRow key={`${transaction.id}-${transaction.bankAccountId}-${index}`}>
                  <TableCell>
                    <div className="font-medium">{transaction.description}</div>
                    <div className="text-sm text-muted-foreground">{new Date(transaction.date + 'T00:00:00').toLocaleDateString()}</div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        'border-0 font-semibold',
                        primaryCategoryColors[category] || primaryCategoryColors['UNCATEGORIZED']
                      )}
                    >
                      {category}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className={cn(
                      'text-right font-medium',
                      transaction.amount > 0 ? 'text-green-600' : 'text-foreground'
                    )}
                  >
                    {transaction.amount > 0 ? '+' : ''}
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'USD',
                    }).format(transaction.amount)}
                  </TableCell>
                </TableRow>
              )})
            ) : (
                <TableRow>
                    <TableCell colSpan={3} className="text-center h-24">
                        No transactions for this period.
                    </TableCell>
                </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
