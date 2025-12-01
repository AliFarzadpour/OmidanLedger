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
import { transactionsData } from '@/lib/data';
import { cn } from '@/lib/utils';

const categoryColors: Record<string, string> = {
  Groceries: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  Income: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  Bills: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  Dining: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  Shopping: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300',
  Entertainment: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
};

export function TransactionsTable() {
  return (
    <Card className="h-full shadow-lg">
      <CardHeader>
        <CardTitle>Recent Transactions</CardTitle>
        <CardDescription>A list of your recent financial activities.</CardDescription>
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
            {transactionsData.map((transaction) => (
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
                      categoryColors[transaction.category] || 'bg-gray-100 text-gray-800'
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
