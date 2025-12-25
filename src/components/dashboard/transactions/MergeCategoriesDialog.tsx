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
import { Loader2, ArrowRight, Combine, AlertCircle, Search, ArrowDownUp } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import type { Transaction } from '../transactions-table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface MergeCategoriesDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type UniqueCategory = {
  id: string;
  l0: string;
  l1: string;
  l2: string;
  l3: string;
};

const PRIMARY_CATEGORY_OPTIONS = ["Asset", "Liability", "Equity", "Income", "Expense"];

export function MergeCategoriesDialog({ isOpen, onOpenChange, onSuccess }: MergeCategoriesDialogProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isMerging, setIsMerging] = useState(false);
  const [uniqueCategories, setUniqueCategories] = useState<UniqueCategory[]>([]);
  const [transactions, setTransactions] = useState<(Transaction & { _originalRef: any })[]>([]);

  const [fromCategories, setFromCategories] = useState<Set<string>>(new Set());
  const [toCategory, setToCategory] = useState<string | null>(null);
  const [overridePrimary, setOverridePrimary] = useState<string | null>(null);

  const [fromFilter, setFromFilter] = useState('');
  const [toFilter, setToFilter] = useState('');
  const [fromSort, setFromSort] = useState<'asc' | 'desc'>('asc');
  const [toSort, setToSort] = useState<'asc' | 'desc'>('asc');


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
        const h = tx.categoryHierarchy || {};
        const id = `${h.l0 || ''}>${h.l1 || ''}>${h.l2 || ''}>${h.l3 || ''}`;
        if (!categoryMap.has(id)) {
          categoryMap.set(id, {
            id,
            l0: h.l0 || '',
            l1: h.l1 || '',
            l2: h.l2 || '',
            l3: h.l3 || ''
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
        const h = tx.categoryHierarchy || {};
        const catId = `${h.l0 || ''}>${h.l1 || ''}>${h.l2 || ''}>${h.l3 || ''}`;
        return fromCategories.has(catId);
    });

    const batch = writeBatch(firestore);
    transactionsToUpdate.forEach(tx => {
      batch.update(tx._originalRef, {
        categoryHierarchy: {
            l0: overridePrimary || destinationCategory.l0,
            l1: destinationCategory.l1,
            l2: destinationCategory.l2,
            l3: destinationCategory.l3,
        }
      });
    });

    try {
      await batch.commit();
      toast({ title: 'Merge Successful', description: `${transactionsToUpdate.length} transactions were updated.` });
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Merge Failed', description: error.message });
    } finally {
      setIsMerging(false);
    }
  };

  const processColumnData = (filter: string, sort: 'asc' | 'desc') => {
    return uniqueCategories
      .filter(cat => cat.id.toLowerCase().includes(filter.toLowerCase()))
      .sort((a, b) => {
        if (sort === 'asc') return a.id.localeCompare(b.id);
        return b.id.localeCompare(a.id);
      });
  };

  const fromColumnData = useMemo(() => processColumnData(fromFilter, fromSort), [uniqueCategories, fromFilter, fromSort]);
  const toColumnData = useMemo(() => processColumnData(toFilter, toSort), [uniqueCategories, toFilter, toSort]);


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Combine/> Merge Transaction Categories</DialogTitle>
          <DialogDescription>Clean up your books by merging multiple categories into one.</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex-1 flex justify-center items-center"><Loader2 className="animate-spin h-8 w-8" /></div>
        ) : uniqueCategories.length === 0 ? (
          <div className="flex-1 flex justify-center items-center"><p>No categories found to merge.</p></div>
        ) : (
          <div className="grid grid-cols-2 gap-6 flex-1 min-h-0 py-4">
            {/* From Column */}
            <div className="flex flex-col border rounded-lg p-4 min-h-0">
              <h3 className="font-semibold mb-2">1. Select categories to merge FROM</h3>
              <div className="flex items-center gap-2 mb-2">
                 <div className="relative flex-grow">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Filter..." className="pl-9 h-9" value={fromFilter} onChange={e => setFromFilter(e.target.value)} />
                 </div>
                 <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setFromSort(s => s === 'asc' ? 'desc' : 'asc')}>
                    <ArrowDownUp className="h-4 w-4"/>
                 </Button>
              </div>
              <ScrollArea className="flex-1 -mr-4 pr-4">
                <div className="space-y-1">
                  {fromColumnData.map(cat => (
                    <div key={cat.id} className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted">
                      <Checkbox id={cat.id} onCheckedChange={() => handleFromToggle(cat.id)} />
                      <label htmlFor={cat.id} className="text-xs leading-tight cursor-pointer">
                        <span className="font-medium text-slate-800">{cat.l0}</span>
                        <span className="text-slate-500"> &gt; {cat.l1} &gt; {cat.l2} &gt; {cat.l3}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
               {fromCategories.size > 0 && (
                <div className="mt-4 pt-4 border-t space-y-2 animate-in fade-in">
                  <Label>Change Primary Category for ALL selected to:</Label>
                   <Select value={overridePrimary || ''} onValueChange={setOverridePrimary}>
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Optional: Change Level 0..." />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIMARY_CATEGORY_OPTIONS.map(opt => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                   </Select>
                </div>
              )}
            </div>

            {/* To Column */}
            <div className="flex flex-col border rounded-lg p-4 bg-muted/50 min-h-0">
              <h3 className="font-semibold mb-2">2. Select category to merge TO</h3>
               <div className="flex items-center gap-2 mb-2">
                 <div className="relative flex-grow">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Filter..." className="pl-9 h-9" value={toFilter} onChange={e => setToFilter(e.target.value)} />
                 </div>
                 <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setToSort(s => s === 'asc' ? 'desc' : 'asc')}>
                    <ArrowDownUp className="h-4 w-4"/>
                 </Button>
              </div>
              <ScrollArea className="flex-1 -mr-4 pr-4">
                <RadioGroup onValueChange={setToCategory}>
                  <div className="space-y-1">
                    {toColumnData.map(cat => (
                      <div key={cat.id} className="flex items-center space-x-2 p-2 rounded-md hover:bg-background">
                        <RadioGroupItem value={cat.id} id={`to-${cat.id}`} />
                        <Label htmlFor={`to-${cat.id}`} className="cursor-pointer text-xs leading-tight">
                           <span className="font-medium text-slate-800">{cat.l0}</span>
                           <span className="text-slate-500"> &gt; {cat.l1} &gt; {cat.l2} &gt; {cat.l3}</span>
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
