'use client';

import { useMemo } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collectionGroup, query, where } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useCollection } from '@/firebase/firestore/use-collection';
import { formatCurrency } from '@/lib/format';
import { Badge } from '@/components/ui/badge';


type Transaction = {
  id: string;
  date: string;
  description: string;
  amount: number;
  primaryCategory: string;
  secondaryCategory?: string;
  subcategory?: string;
  userId: string;
};

type CategorySummary = {
  name: string;
  total: number;
  count: number;
};

const primaryCategoryColors: Record<string, string> = {
  'Income': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  'Cost of Goods Sold': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  'Operating Expenses': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  'Other Expenses': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  'Uncategorized': 'bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
};


export function ChartOfAccountsReport() {
  const { user } = useUser();
  const firestore = useFirestore();

  const transactionsQuery = useMemo(() => {
    if (!user?.uid || !firestore) return null;
    
    return query(
      collectionGroup(firestore, 'transactions'),
      where('userId', '==', user.uid)
    );
  }, [user?.uid, firestore]);

  const { data: transactions, isLoading, error } = useCollection<Transaction>(transactionsQuery);

  const categoryData = useMemo((): CategorySummary[] => {
    if (!transactions) return [];

    const map = new Map<string, CategorySummary>();

    transactions.forEach((txn) => {
      const categoryName = txn.primaryCategory || 'Uncategorized';
      
      const current = map.get(categoryName) || { name: categoryName, total: 0, count: 0 };
      
      map.set(categoryName, {
        name: categoryName,
        total: current.total + (txn.amount), 
        count: current.count + 1
      });
    });

    return Array.from(map.values()).sort((a, b) => {
      // Sort income first, then expenses from highest to lowest
      if (a.total > 0 && b.total <= 0) return -1;
      if (a.total <= 0 && b.total > 0) return 1;
      return b.total - a.total;
    });
  }, [transactions]);

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Chart of Accounts</h1>
            <p className="text-muted-foreground">A summary of total income and expenses by primary category.</p>
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
  
  if (error) {
     return (
      <div className="p-4 text-red-500 bg-red-100 rounded-md border border-red-200">
        <p className="font-bold">Error Loading Data</p>
        <p className="text-sm">{error.message}</p>
        {error.message.includes('requires an index') && (
           <p className="text-xs mt-2">A Firestore index is required. Check the browser console for the creation link and ask the assistant to apply it if needed.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Chart of Accounts</h1>
        <p className="text-muted-foreground">A summary of total income and expenses by primary category.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
            {categoryData.length === 0 ? (
                 <p className="text-center text-muted-foreground py-8">
                    No categories found. Once you have categorized transactions, your Chart of Accounts will appear here.
                </p>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Category</TableHead>
                            <TableHead>Transactions</TableHead>
                            <TableHead className="text-right">Total Amount</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {categoryData.map((category) => (
                            <TableRow key={category.name}>
                                <TableCell className="font-medium">
                                  <Badge
                                      variant="outline"
                                      className={`${primaryCategoryColors[category.name] || primaryCategoryColors['Uncategorized']} border-0`}
                                  >
                                    {category.name}
                                  </Badge>
                                </TableCell>
                                <TableCell>{category.count}</TableCell>
                                <TableCell className="text-right font-medium">
                                    {formatCurrency(category.total)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
