'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collectionGroup, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowRight, Combine, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import type { Transaction } from '../transactions-table';

interface MergeCategoriesDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

type UniqueCategory = {
  id: string;
  primary: string;
  secondary: string;
  sub: string;
};

export function MergeCategoriesDialog({ isOpen, onOpenChange }: MergeCategoriesDialogProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isMerging, setIsMerging] = useState(false);
  const [uniqueCategories, setUniqueCategories] = useState<UniqueCategory[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [fromCategories, setFromCategories] = useState<Set<string>>(new Set());
  const [toCategory, setToCategory] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !user || !firestore) return;

    const fetchData = async () => {
      setIsLoading(true);
      const q = query(collectionGroup(firestore, 'transactions'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      const allTxs = snapshot.docs.map(d => ({ id: d.id, ...d.data(), _originalRef: d.ref })) as (Transaction & { _originalRef: any })[];
      setTransactions(allTxs);

      const categoryMap = new Map<string, UniqueCategory>();
      allTxs.forEach(tx => {
        const id = `${tx.primaryCategory}>${tx.secondaryCategory}>${tx.subcategory}`;
        if (!categoryMap.has(id)) {
          categoryMap.set(id, {
            id,
            primary: tx.primaryCategory,
            secondary: tx.secondaryCategory,
            sub: tx.subcategory,
          });
        }
      });
      setUniqueCategories(Array.from(categoryMap.values()).sort((a, b) => a.id.localeCompare(b.id)));
      setIsLoading(false);
    };

    fetchData();
  }, [isOpen, user, firestore]);

  const handleFromToggle = (categoryId: string) => {
    const newFrom = new Set(fromCategories);
    if (newFrom.has(categoryId)) {
      newFrom.delete(categoryId);
    } else {
      newFrom.add(categoryId);
    }
    setFromCategories(newFrom);
  };

  const handleMerge = async () => {
    if (!toCategory || fromCategories.size === 0 || !firestore) {
      toast({ variant: 'destructive', title: 'Selection Missing', description: 'Please select categories to merge from and a category to merge to.' });
      return;
    }
    setIsMerging(true);

    const destinationCategory = uniqueCategories.find(c => c.id === toCategory);
    if (!destinationCategory) {
      toast({ variant: 'destructive', title: 'Error', description: 'Destination category not found.' });
      setIsMerging(false);
      return;
    }
    
    const transactionsToUpdate = transactions.filter(tx => {
        const catId = `${tx.primaryCategory}>${tx.secondaryCategory}>${tx.subcategory}`;
        return fromCategories.has(catId);
    });

    const batch = writeBatch(firestore);
    transactionsToUpdate.forEach(tx => {
      batch.update(tx._originalRef, {
        primaryCategory: destinationCategory.primary,
        secondaryCategory: destinationCategory.secondary,
        subcategory: destinationCategory.sub,
      });
    });

    try {
      await batch.commit();
      toast({ title: 'Merge Successful', description: `${transactionsToUpdate.length} transactions were updated.` });
      onOpenChange(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Merge Failed', description: error.message });
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Combine/> Merge Transaction Categories</DialogTitle>
          <DialogDescription>Clean up your books by merging multiple categories into one.</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center items-center h-full"><Loader2 className="animate-spin h-8 w-8" /></div>
        ) : uniqueCategories.length === 0 ? (
          <div className="flex justify-center items-center h-full"><p>No categories found to merge.</p></div>
        ) : (
          <div className="grid grid-cols-2 gap-6 h-full py-4">
            {/* From Column */}
            <div className="flex flex-col border rounded-lg p-4">
              <h3 className="font-semibold mb-2">1. Select categories to merge FROM</h3>
              <ScrollArea className="flex-1">
                <div className="space-y-2">
                  {uniqueCategories.map(cat => (
                    <div key={cat.id} className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted">
                      <Checkbox id={cat.id} onCheckedChange={() => handleFromToggle(cat.id)} />
                      <label htmlFor={cat.id} className="text-sm font-medium leading-none cursor-pointer">
                        {cat.primary}
                        <span className="text-muted-foreground"> &gt; {cat.secondary} &gt; {cat.sub}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* To Column */}
            <div className="flex flex-col border rounded-lg p-4 bg-muted/50">
              <h3 className="font-semibold mb-2">2. Select category to merge TO</h3>
              <ScrollArea className="flex-1">
                <RadioGroup onValueChange={setToCategory}>
                  <div className="space-y-2">
                    {uniqueCategories.map(cat => (
                      <div key={cat.id} className="flex items-center space-x-2 p-2 rounded-md hover:bg-background">
                        <RadioGroupItem value={cat.id} id={`to-${cat.id}`} />
                        <Label htmlFor={`to-${cat.id}`} className="cursor-pointer">
                          {cat.primary}
                          <span className="text-muted-foreground"> &gt; {cat.secondary} &gt; {cat.sub}</span>
                        </Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
              </ScrollArea>
            </div>
          </div>
        )}

        <DialogFooter>
          <div className="w-full flex justify-between items-center">
             <Alert variant="destructive" className="w-auto max-w-sm">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Warning</AlertTitle>
                <AlertDescription>
                    This action is permanent and cannot be undone.
                </AlertDescription>
            </Alert>
            <div>
                 <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                 <Button onClick={handleMerge} disabled={isMerging || !toCategory || fromCategories.size === 0} className="ml-2">
                    {isMerging ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                    Merge {fromCategories.size} categories
                </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
