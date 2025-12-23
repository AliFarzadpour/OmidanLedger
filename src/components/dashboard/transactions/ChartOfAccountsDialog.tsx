'use client';

import { useMemo } from 'react';
import { collectionGroup, query, where } from 'firebase/firestore';
import { useFirestore, useUser, useCollection } from '@/firebase';
import { formatCurrency } from '@/lib/format';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, BookUser } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"


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
  type: 'Income' | 'Expense' | 'Other';
};

interface ChartOfAccountsDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ChartOfAccountsDialog({ isOpen, onOpenChange }: ChartOfAccountsDialogProps) {
  const { user } = useUser();
  const firestore = useFirestore();

  const transactionsQuery = useMemo(() => {
    if (!user || !firestore) return null;
    return query(collectionGroup(firestore, 'transactions'), where('userId', '==', user.uid));
  }, [user, firestore]);

  const { data: transactions, isLoading, error } = useCollection<Transaction>(transactionsQuery);

  const { income, expenses } = useMemo(() => {
    if (!transactions) return { income: [], expenses: [] };

    const map = new Map<string, CategorySummary>();

    transactions.forEach((txn) => {
      const categoryName = txn.primaryCategory || 'Uncategorized';
      const current = map.get(categoryName) || {
        name: categoryName,
        total: 0,
        count: 0,
        type: txn.amount > 0 ? 'Income' : 'Expense',
      };
      map.set(categoryName, {
        ...current,
        total: current.total + txn.amount,
        count: current.count + 1,
      });
    });

    const allCategories = Array.from(map.values());
    const income = allCategories
      .filter((c) => c.type === 'Income')
      .sort((a, b) => b.total - a.total);
    const expenses = allCategories
      .filter((c) => c.type === 'Expense')
      .sort((a, b) => a.total - b.total); 

    return { income, expenses };
  }, [transactions]);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="space-y-4">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      );
    }

    if (error) {
      return (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Data</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      );
    }

    if (!transactions || transactions.length === 0) {
      return (
        <p className="py-8 text-center text-muted-foreground">
          No categories found. Once you have categorized transactions, your Chart of Accounts will appear here.
        </p>
      );
    }

    return (
      <div className="space-y-8 max-h-[60vh] overflow-y-auto pr-4">
        <CategorySection title="Income" categories={income} />
        <CategorySection title="Expenses" categories={expenses} />
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    <BookUser className="h-5 w-5" />
                    Chart of Accounts
                </DialogTitle>
                <DialogDescription>A summary of total income and expenses by category.</DialogDescription>
            </DialogHeader>
            <div className="py-4">
                {renderContent()}
            </div>
        </DialogContent>
    </Dialog>
  );
}

function CategorySection({ title, categories }: { title: string; categories: CategorySummary[] }) {
  if (categories.length === 0) return null;

  return (
    <div>
      <h3 className="mb-4 text-lg font-semibold">{title}</h3>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead>Transactions</TableHead>
              <TableHead className="text-right">Total Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((category) => (
              <TableRow key={category.name}>
                <TableCell className="font-medium">{category.name}</TableCell>
                <TableCell>{category.count}</TableCell>
                <TableCell className="text-right">{formatCurrency(category.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
