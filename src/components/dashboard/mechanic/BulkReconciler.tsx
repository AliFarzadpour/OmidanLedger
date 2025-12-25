'use client';

import { useState, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, writeBatch, getDocs, query, where } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, ArrowLeft, Wand2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { learnCategoryMapping } from '@/ai/flows/learn-category-mapping';

type Transaction = {
  id: string;
  description: string;
  amount: number;
  date: string;
  primaryCategory: string;
  secondaryCategory: string;
  subcategory: string;
  bankAccountId: string;
};

export function BulkReconciler() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<any | null>(null);

  const transactionsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, `users/${user.uid}/transactions`),
      where('reviewStatus', 'in', ['needs-review', 'incorrect'])
    );
  }, [user, firestore]);

  const { data: transactions, isLoading } = useCollection<Transaction>(transactionsQuery);

  const groupedTransactions = useMemo(() => {
    if (!transactions) return [];
    const groups = new Map<string, Transaction[]>();
    transactions.forEach(tx => {
      const desc = tx.description;
      if (!groups.has(desc)) {
        groups.set(desc, []);
      }
      groups.get(desc)!.push(tx);
    });
    return Array.from(groups.entries()).map(([description, items]) => ({
      description,
      items,
      count: items.length,
      total: items.reduce((sum, i) => sum + i.amount, 0)
    }));
  }, [transactions]);

  const handleFixAndCreateRule = async (group: any, newCategory: any) => {
    if (!user || !firestore || !selectedCategory) return;
    setIsProcessing(true);

    const { primaryCategory, secondaryCategory, subcategory } = newCategory;

    try {
      const batch = writeBatch(firestore);
      group.items.forEach((tx: Transaction) => {
        const txRef = doc(firestore, `users/${user.uid}/bankAccounts/${tx.bankAccountId}/transactions`, tx.id);
        batch.update(txRef, {
          primaryCategory,
          secondaryCategory,
          subcategory,
          reviewStatus: 'approved'
        });
      });
      await batch.commit();

      await learnCategoryMapping({
        transactionDescription: group.description,
        primaryCategory,
        secondaryCategory,
        subcategory,
        userId: user.uid
      });

      toast({
        title: "Success!",
        description: `${group.count} transactions updated and a new rule was created.`
      });

    } catch (e: any) {
      toast({ variant: 'destructive', title: "Error", description: e.message });
    } finally {
      setIsProcessing(false);
      setSelectedCategory(null);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-20"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Category Mechanic</h1>
          <p className="text-muted-foreground">Fix uncategorized transactions and create smart rules.</p>
        </div>
      </div>
      
      {groupedTransactions.length === 0 ? (
        <Card className="text-center py-20">
          <CardHeader>
            <CardTitle>All Clean!</CardTitle>
            <CardDescription>No transactions are currently waiting for review.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-4">
          {groupedTransactions.map((group) => (
            <Card key={group.description}>
              <CardHeader>
                <CardTitle className="text-lg">{group.description}</CardTitle>
                <CardDescription>{group.count} transactions totaling ${group.total.toFixed(2)}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => alert('AI Suggestion logic to be implemented.')} disabled={isProcessing}>
                  <Wand2 className="mr-2 h-4 w-4" /> AI Suggestion
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
