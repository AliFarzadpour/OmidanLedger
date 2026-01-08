'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { createExpenseFromWorkOrder } from '@/actions/accounting-actions';
import { Loader2, CalendarIcon, Receipt } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const workOrderCategoryToAccountingMap: Record<string, { l1: string, l2: string }> = {
    'Plumbing': { l1: 'Repairs', l2: 'Line 14: Repairs' },
    'HVAC': { l1: 'Repairs', l2: 'Line 14: Repairs' },
    'Electrical': { l1: 'Repairs', l2: 'Line 14: Repairs' },
    'Appliance': { l1: 'Repairs', l2: 'Line 14: Repairs' },
    'Turnover': { l1: 'Repairs', l2: 'Line 7: Cleaning and maintenance' },
    'Cleaning': { l1: 'Repairs', l2: 'Line 7: Cleaning and maintenance' },
    'Landscaping': { l1: 'Repairs', l2: 'Line 7: Cleaning and maintenance' },
    'Other': { l1: 'Property Operations', l2: 'Line 19: Other' },
};


export function CreateExpenseFromWorkOrderDialog({ workOrder, onUpdate }: { workOrder: any, onUpdate: () => void }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [bankAccountId, setBankAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [l1, setL1] = useState('');
  const [l2, setL2] = useState('');

  const { data: bankAccounts, isLoading: isLoadingAccounts } = useCollection(
    useMemoFirebase(() => user ? collection(firestore, `users/${user.uid}/bankAccounts`) : null, [user, firestore])
  );
  
  useEffect(() => {
    if (workOrder) {
      setAmount(String(workOrder.actualCost || workOrder.estimatedCost || ''));
      const mapping = workOrderCategoryToAccountingMap[workOrder.category] || { l1: 'Property Operations', l2: 'Line 19: Other' };
      setL1(mapping.l1);
      setL2(mapping.l2);
    }
  }, [workOrder]);

  const handleSubmit = async () => {
    if (!user || !workOrder) return;
    setIsSaving(true);
    try {
      await createExpenseFromWorkOrder({
        userId: user.uid,
        workOrderId: workOrder.id,
        bankAccountId,
        propertyId: workOrder.propertyId,
        vendorId: workOrder.vendorId,
        amount: Number(amount),
        date: format(date, 'yyyy-MM-dd'),
        description: `Work Order: ${workOrder.title}`,
        category: { l0: 'OPERATING EXPENSE', l1, l2, l3: workOrder.category || '' }
      });
      toast({ title: 'Expense Created', description: 'The transaction has been recorded.' });
      onUpdate();
      setIsOpen(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="w-full">
            <Receipt className="mr-2 h-4 w-4"/>
            Create Expense
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Expense from Work Order</DialogTitle>
          <DialogDescription>
            This will create a new expense transaction in your accounting ledger.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid gap-2">
            <Label>Payment Source Account</Label>
            <Select onValueChange={setBankAccountId} value={bankAccountId} disabled={isLoadingAccounts}>
              <SelectTrigger><SelectValue placeholder="Select an account..." /></SelectTrigger>
              <SelectContent>
                {bankAccounts?.map(acc => (
                  <SelectItem key={acc.id} value={acc.id}>{acc.accountName} ({acc.bankName})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Amount</Label>
              <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Payment Date</Label>
               <Popover>
                <PopoverTrigger asChild>
                  <Button variant={"outline"} className={cn("justify-start text-left font-normal", !date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="grid gap-2">
             <Label>Expense Category (L1)</Label>
             <Input value={l1} onChange={e => setL1(e.target.value)} />
          </div>
           <div className="grid gap-2">
             <Label>Tax Line Item (L2)</Label>
             <Input value={l2} onChange={e => setL2(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSaving || !bankAccountId || !amount}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Confirm & Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
