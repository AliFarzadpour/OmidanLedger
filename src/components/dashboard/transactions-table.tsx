'use client';

import { useState, useMemo } from 'react';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
import { Upload, ArrowUpDown, Trash2 } from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc, writeBatch, getDocs } from 'firebase/firestore';
import { UploadTransactionsDialog } from './transactions/upload-transactions-dialog';
import { Skeleton } from '../ui/skeleton';
import { useToast } from '@/hooks/use-toast';

const primaryCategoryColors: Record<string, string> = {
  'Income': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  'Cost of Goods Sold': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  'Operating Expenses': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  'Other Expenses': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  'Balance Sheet Categories': 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
};


interface DataSource {
  id: string;
  accountName: string;
  bankName: string;
}

interface Transaction {
  id: string;
  date: string;
  description: string;
  primaryCategory: string;
  secondaryCategory: string;
  subcategory: string;
  amount: number;
}

type SortKey = 'date' | 'description' | 'category' | 'amount';
type SortDirection = 'ascending' | 'descending';

interface TransactionsTableProps {
  dataSource: DataSource;
}

export function TransactionsTable({ dataSource }: TransactionsTableProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isUploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isClearAlertOpen, setClearAlertOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'date',
    direction: 'descending',
  });

  const transactionsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !dataSource) return null;
    return collection(firestore, `users/${user.uid}/bankAccounts/${dataSource.id}/transactions`);
  }, [firestore, user, dataSource]);

  const { data: transactions, isLoading } = useCollection<Transaction>(transactionsQuery);

  const handleClearTransactions = async () => {
    if (!firestore || !user || !dataSource || !transactionsQuery) return;

    setIsClearing(true);
    setClearAlertOpen(false);

    try {
        const querySnapshot = await getDocs(transactionsQuery);
        const batch = writeBatch(firestore);
        querySnapshot.forEach((doc) => {
            batch.delete(doc.ref);
        });
        await batch.commit();

        toast({
            title: "Transactions Cleared",
            description: `All transactions for ${dataSource.accountName} have been deleted.`,
        });
    } catch (error) {
        console.error("Error clearing transactions:", error);
        toast({
            variant: "destructive",
            title: "Error Clearing Transactions",
            description: "An unexpected error occurred while clearing transactions.",
        });
    } finally {
        setIsClearing(false);
    }
  };


  const sortedTransactions = useMemo(() => {
    if (!transactions) return [];
    const sortableItems = [...transactions];
    sortableItems.sort((a, b) => {
      let aValue: string | number, bValue: string | number;

      if (sortConfig.key === 'category') {
        aValue = `${a.primaryCategory}${a.secondaryCategory}${a.subcategory}`;
        bValue = `${b.primaryCategory}${b.secondaryCategory}${b.subcategory}`;
      } else if (sortConfig.key === 'date') {
        return sortConfig.direction === 'ascending'
          ? new Date(a.date).getTime() - new Date(b.date).getTime()
          : new Date(b.date).getTime() - new Date(a.date).getTime();
      } else {
        aValue = a[sortConfig.key as keyof Omit<Transaction, 'id' | 'date'>];
        bValue = b[sortConfig.key as keyof Omit<Transaction, 'id' | 'date'>];
      }
      
      let comparison = 0;
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      }
      
      return sortConfig.direction === 'ascending' ? comparison : -comparison;
    });
    return sortableItems;
  }, [transactions, sortConfig]);

  const requestSort = (key: SortKey) => {
    let direction: SortDirection = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  const getSortIcon = (key: SortKey) => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />;
    }
    return sortConfig.direction === 'ascending' ? (
      <ArrowUpDown className="ml-2 h-4 w-4" />
    ) : (
      <ArrowUpDown className="ml-2 h-4 w-4" />
    );
  };

  const hasTransactions = transactions && transactions.length > 0;

  return (
    <>
      <Card className="h-full shadow-lg">
        <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <CardTitle>Transactions for {dataSource.accountName}</CardTitle>
            <CardDescription>
              Showing all transactions from {dataSource.bankName}.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setUploadDialogOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Upload Statement
            </Button>
            <Button 
                variant="destructive" 
                onClick={() => setClearAlertOpen(true)}
                disabled={!hasTransactions || isClearing}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {isClearing ? 'Clearing...' : 'Clear All'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="p-2">
                   <Button variant="ghost" onClick={() => requestSort('date')}>
                    Date {getSortIcon('date')}
                  </Button>
                </TableHead>
                <TableHead className="p-2">
                  <Button variant="ghost" onClick={() => requestSort('description')}>
                    Description {getSortIcon('description')}
                  </Button>
                </TableHead>
                <TableHead className="p-2">
                  <Button variant="ghost" onClick={() => requestSort('category')}>
                    Category {getSortIcon('category')}
                  </Button>
                </TableHead>
                <TableHead className="text-right p-2">
                  <Button variant="ghost" onClick={() => requestSort('amount')}>
                    Amount {getSortIcon('amount')}
                  </Button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-3/4" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-40 rounded-full" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="h-5 w-16 ml-auto" />
                    </TableCell>
                  </TableRow>
                ))
              ) : sortedTransactions && sortedTransactions.length > 0 ? (
                sortedTransactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                     <TableCell>
                        <div className="text-sm text-muted-foreground">{new Date(transaction.date).toLocaleDateString()}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{transaction.description}</div>
                    </TableCell>
                    <TableCell>
                       <div className="flex flex-col">
                        <Badge
                          variant="outline"
                          className={cn(
                            'w-fit border-0 font-semibold',
                            primaryCategoryColors[transaction.primaryCategory] || primaryCategoryColors['Other']
                          )}
                        >
                          {transaction.primaryCategory}
                        </Badge>
                        <span className="text-xs text-muted-foreground pl-1">
                          {transaction.secondaryCategory} &gt; {transaction.subcategory}
                        </span>
                      </div>
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
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    No transactions found. Upload a statement to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <UploadTransactionsDialog
        isOpen={isUploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        dataSource={dataSource}
      />
      <AlertDialog open={isClearAlertOpen} onOpenChange={setClearAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete all
              transactions for <strong>{dataSource.accountName}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={handleClearTransactions}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
