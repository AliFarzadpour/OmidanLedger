
'use client';

import { useState, useMemo } from 'react';
import { useUser, useFirestore, updateDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import { learnCategoryMapping } from '@/ai/flows/learn-category-mapping';
import { useToast } from '@/hooks/use-toast';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Pencil, Edit, Search, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Transaction } from '../transactions-table';
import { Checkbox } from '@/components/ui/checkbox';
import { BatchEditDialog } from '../transactions/batch-edit-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

const primaryCategoryColors: Record<string, string> = {
  'Income': 'bg-green-100 text-green-800',
  'Expense': 'bg-blue-100 text-blue-800',
  'Equity': 'bg-indigo-100 text-indigo-800',
  'Liability': 'bg-orange-100 text-orange-800',
  'Asset': 'bg-gray-200 text-gray-800',
};

function CategoryEditor({ transaction, onSave }: { transaction: Transaction, onSave: (tx: Transaction, cats: any) => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const cats = transaction.categoryHierarchy || { l0: '', l1: '', l2: '', l3: '' };
    
    const [l0, setL0] = useState(cats.l0);
    const [l1, setL1] = useState(cats.l1);
    const [l2, setL2] = useState(cats.l2);
    const [l3, setL3] = useState(cats.l3);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const newCats = { l0, l1, l2, l3 };
        onSave(transaction, newCats);
        setIsOpen(false);
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <div className="flex flex-col cursor-pointer group hover:opacity-80 transition-opacity items-start">
                    <Badge variant="outline" className={cn('w-fit border-0 font-semibold px-2 py-1', primaryCategoryColors[cats.l0] || 'bg-slate-100')}>
                        {cats.l0}
                        <Pencil className="ml-2 h-3 w-3 opacity-0 group-hover:opacity-100" />
                    </Badge>
                    <span className="text-xs text-muted-foreground pl-1 mt-0.5">
                        {cats.l1} {'>'} {cats.l2}
                    </span>
                    {cats.l3 && (
                         <span className="text-xs text-muted-foreground pl-1 font-medium">
                            {cats.l3}
                        </span>
                    )}
                </div>
            </PopoverTrigger>
            <PopoverContent className="w-80">
                <form onSubmit={handleSubmit} className="grid gap-4">
                    <div className="space-y-2">
                        <h4 className="font-medium leading-none">Edit Category</h4>
                        <p className="text-sm text-muted-foreground">Confirm or correct the assignment.</p>
                    </div>
                    <div className="grid gap-2">
                        <div className="grid grid-cols-3 items-center gap-4"><Label htmlFor="l0">L0</Label><Input id="l0" value={l0} onChange={(e) => setL0(e.target.value)} className="col-span-2 h-8" /></div>
                        <div className="grid grid-cols-3 items-center gap-4"><Label htmlFor="l1">L1</Label><Input id="l1" value={l1} onChange={(e) => setL1(e.target.value)} className="col-span-2 h-8" /></div>
                        <div className="grid grid-cols-3 items-center gap-4"><Label htmlFor="l2">L2</Label><Input id="l2" value={l2} onChange={(e) => setL2(e.target.value)} className="col-span-2 h-8" /></div>
                         <div className="grid grid-cols-3 items-center gap-4"><Label htmlFor="l3">L3</Label><Input id="l3" value={l3} onChange={(e) => setL3(e.target.value)} className="col-span-2 h-8" /></div>
                    </div>
                    <Button type="submit">Confirm & Save</Button>
                </form>
            </PopoverContent>
        </Popover>
    );
}

type SortKey = 'date' | 'description' | 'category' | 'amount';

export function ProfitAndLossDrawer({ isOpen, onOpenChange, category, onUpdate }: { isOpen: boolean, onOpenChange: (open: boolean) => void, category: { name: string; transactions: Transaction[] }, onUpdate: () => void }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBatchEditDialogOpen, setBatchEditDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });

  const filteredAndSortedTransactions = useMemo(() => {
    let filtered = category.transactions.filter(tx => 
      tx.description.toLowerCase().includes(searchTerm.toLowerCase())
    );

    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      if (sortConfig.key === 'date') {
        aValue = new Date(a.date).getTime();
        bValue = new Date(b.date).getTime();
      } else if (sortConfig.key === 'amount') {
        aValue = a.amount;
        bValue = b.amount;
      } else if (sortConfig.key === 'description') {
        aValue = a.description;
        bValue = b.description;
      } else if (sortConfig.key === 'category') {
          aValue = `${a.categoryHierarchy?.l0 || ''}${a.categoryHierarchy?.l1 || ''}${a.categoryHierarchy?.l2 || ''}`;
          bValue = `${b.categoryHierarchy?.l0 || ''}${b.categoryHierarchy?.l1 || ''}${b.categoryHierarchy?.l2 || ''}`;
      } else {
        aValue = a[sortConfig.key as keyof typeof a];
        bValue = b[sortConfig.key as keyof typeof b];
      }
      
      if (typeof aValue === 'string') {
        return sortConfig.direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }
      return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
    });

    return filtered;
  }, [category.transactions, searchTerm, sortConfig]);

  const selectedTransactions = filteredAndSortedTransactions.filter(tx => selectedIds.includes(tx.id));

  const handleSort = (key: SortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const getSortIcon = (key: SortKey) => {
      return sortConfig.key === key 
        ? <ArrowUpDown className="h-4 w-4 inline ml-2" />
        : <ArrowUpDown className="h-4 w-4 inline ml-2 opacity-30" />
  }

  const handleSelectionChange = (id: string, checked: boolean) => {
    setSelectedIds(prev => 
        checked ? [...prev, id] : prev.filter(i => i !== id)
    );
  };
  
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredAndSortedTransactions.map(t => t.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleCategoryChange = (transaction: Transaction, newCategories: { l0: string; l1: string; l2: string; l3: string }) => {
    if (!user || !firestore || !transaction.bankAccountId) return;
    
    const transactionRef = doc(firestore, `users/${user.uid}/bankAccounts/${transaction.bankAccountId}/transactions`, transaction.id);
    
    const updateData = {
        categoryHierarchy: { ...newCategories },
        reviewStatus: 'approved'
    };
    
    updateDocumentNonBlocking(transactionRef, updateData);

    learnCategoryMapping({
        transactionDescription: transaction.description,
        primaryCategory: newCategories.l0,
        secondaryCategory: newCategories.l1,
        subcategory: newCategories.l2,
        details: newCategories.l3,
        userId: user.uid,
    });
    toast({ title: "Updated", description: "Category saved and rule learned." });
    onUpdate(); // Trigger the refetch on the parent component
  };
  
  return (
    <>
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-[800px] sm:max-w-none flex flex-col">
        <SheetHeader>
          <SheetTitle>Transactions for: {category.name}</SheetTitle>
          <SheetDescription>
            This list shows all the transactions that make up this line item on your report.
          </SheetDescription>
        </SheetHeader>
        
        <div className="flex items-center gap-2 py-4">
          <div className="relative flex-grow">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Filter by description..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {selectedIds.length > 0 && (
            <div className="my-4 flex items-center gap-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex-grow">
                    <span className="font-semibold text-blue-800">{selectedIds.length}</span> items selected.
                </div>
                 <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBatchEditDialogOpen(true)}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Batch Edit
                </Button>
            </div>
        )}

        <div className="mt-4 flex-1 min-h-0">
          <ScrollArea className="h-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={filteredAndSortedTransactions.length > 0 && selectedIds.length === filteredAndSortedTransactions.length}
                      onCheckedChange={(checked) => handleSelectAll(!!checked)}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" className="px-0" onClick={() => handleSort('description')}>
                        Details {getSortIcon('description')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" className="px-0" onClick={() => handleSort('category')}>
                        Category {getSortIcon('category')}
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button variant="ghost" className="px-0" onClick={() => handleSort('amount')}>
                        Amount {getSortIcon('amount')}
                    </Button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedTransactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>
                      <Checkbox 
                        checked={selectedIds.includes(transaction.id)}
                        onCheckedChange={(checked) => handleSelectionChange(transaction.id, !!checked)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground">{new Date(transaction.date + 'T00:00:00').toLocaleDateString()}</div>
                      <div className="font-medium max-w-[200px] truncate">{transaction.description}</div>
                    </TableCell>
                    <TableCell>
                      <CategoryEditor transaction={transaction} onSave={handleCategoryChange} />
                    </TableCell>
                    <TableCell className={cn('text-right font-medium', transaction.amount > 0 ? 'text-green-600' : 'text-foreground')}>
                      {transaction.amount > 0 ? '+' : ''}{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(transaction.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
    {isBatchEditDialogOpen && (
        <BatchEditDialog
          isOpen={isBatchEditDialogOpen}
          onOpenChange={setBatchEditDialogOpen}
          transactions={selectedTransactions}
          onSuccess={() => {
            setSelectedIds([]);
            onUpdate();
          }}
        />
      )}
    </>
  );
}

    