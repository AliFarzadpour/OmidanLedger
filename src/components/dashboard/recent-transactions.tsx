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
import { transactionsData } from '@/lib/data'; // Using placeholder data for now

const categoryColors: Record<string, string> = {
  'Income': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  'Groceries': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  'Bills': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  'Dining': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  'Shopping': 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300',
  'Entertainment': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
  'Other': 'bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
};


export function RecentTransactions() {
  const recentTransactions = transactionsData.slice(0, 5); // Show first 5 for summary

  return (
    <Card className="h-full shadow-lg">
      <CardHeader>
        <CardTitle>Recent Transactions</CardTitle>
        <CardDescription>
          Here are your most recent transactions from all accounts.
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
            {recentTransactions.map((transaction) => (
              <TableRow key={transaction.id}>
                <TableCell>
                  <div className="font-medium">{transaction.description}</div>
                  <div className="text-sm text-muted-foreground">{transaction.date}</div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn(
                      'border-0',
                      categoryColors[transaction.category] || categoryColors['Other']
                    )}
                  >
                    {transaction.category}
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
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
