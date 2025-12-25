'use client';

import { useState } from 'react';
import { useUser, useFirestore, updateDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import { learnCategoryMapping } from '@/ai/flows/learn-category-mapping';
import { useToast } from '@/hooks/use-toast';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Transaction } from '../transactions-table';

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
                        {cats.l1} > {cats.l2}
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


export function ProfitAndLossDrawer({ isOpen, onOpenChange, category }: { isOpen: boolean, onOpenChange: (open: boolean) => void, category: { name: string; transactions: Transaction[] } }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

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
  };
  
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-[600px] sm:max-w-none">
        <SheetHeader>
          <SheetTitle>Transactions for: {category.name}</SheetTitle>
          <SheetDescription>
            This list shows all the transactions that make up this line item on your report.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4">
          <Table>
            <TableBody>
              {category.transactions.map((transaction) => (
                <TableRow key={transaction.id}>
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
        </div>
      </SheetContent>
    </Sheet>
  );
}
