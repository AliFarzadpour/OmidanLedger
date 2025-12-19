'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, getDocs, addDoc, doc, writeBatch, increment } from 'firebase/firestore'; 
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CalendarIcon, Loader2, Plus, Receipt } from 'lucide-react';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { VendorSelector } from './vendor-selector';

export function EnterBillDialog({ triggerButton }: { triggerButton?: React.ReactNode }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Data Sources
  const [properties, setProperties] = useState<any[]>([]);
  const [propertyAccounts, setPropertyAccounts] = useState<any[]>([]);

  // Form State
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [selectedExpenseAccountId, setSelectedExpenseAccountId] = useState('');
  
  const [formData, setFormData] = useState({
    amount: '',
    invoiceNumber: '',
    description: '',
    date: new Date(),
    dueDate: new Date(new Date().setDate(new Date().getDate() + 30)), 
  });

  // 1. Fetch Properties on Load
  useEffect(() => {
    const loadProps = async () => {
      if (!user || !firestore || !isOpen) return; // <-- Ensure firestore is ready and dialog is open
      const q = query(collection(firestore, 'properties'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      setProperties(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    loadProps();
  }, [user, firestore, isOpen]);

  // 2. When Property Changes -> Fetch ITS Ledger Accounts
  useEffect(() => {
    const loadAccounts = async () => {
      if (!selectedPropertyId || !firestore || !user) return; 
      
      const q = query(
        collection(firestore, 'accounts'), 
        where('propertyId', '==', selectedPropertyId),
        where('type', '==', 'Expense'),
        where('userId', '==', user.uid)
      );
      const snap = await getDocs(q);
      setPropertyAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    loadAccounts();
  }, [selectedPropertyId, firestore, user]); 

  // 3. Auto-Select Expense Account if Vendor has a Default
  useEffect(() => {
    if (selectedVendor?.defaultCategory && propertyAccounts.length > 0) {
       const match = propertyAccounts.find(acc => 
          acc.name.toLowerCase().includes(selectedVendor.defaultCategory.toLowerCase()) ||
          acc.subtype?.toLowerCase().includes(selectedVendor.defaultCategory.toLowerCase())
       );
       if (match) setSelectedExpenseAccountId(match.id);
    }
  }, [selectedVendor, propertyAccounts]);

  const handleSubmit = async () => {
    if (!user) return;
    if (!selectedPropertyId || !selectedVendor || !formData.amount || !selectedExpenseAccountId) {
      toast({ variant: "destructive", title: "Missing Fields", description: "Please fill out all required fields." });
      return;
    }

    setIsSaving(true);
    try {
      const batch = writeBatch(firestore);
      const amount = parseFloat(formData.amount);

      // A. Create the Bill Record
      const billRef = doc(collection(firestore, 'bills'));
      const property = properties.find(p => p.id === selectedPropertyId);
      
      batch.set(billRef, {
        userId: user.uid,
        propertyId: selectedPropertyId,
        propertyName: property?.name,
        vendorId: selectedVendor.id,
        vendorName: selectedVendor.name,
        expenseAccountId: selectedExpenseAccountId,
        amount: amount,
        balance: amount,
        status: 'unpaid',
        invoiceNumber: formData.invoiceNumber,
        description: formData.description,
        date: formData.date.toISOString(),
        dueDate: formData.dueDate.toISOString(),
        createdAt: new Date().toISOString()
      });

      // B. DOUBLE ENTRY ACCOUNTING
      
      // 1. CREDIT: Accounts Payable
      const apAccountRef = property?.accounting?.accountsPayableAccount 
         ? doc(firestore, 'accounts', property.accounting.accountsPayableAccount)
         : null;

      if (apAccountRef) {
         batch.update(apAccountRef, { balance: increment(amount) });
      }

      // 2. DEBIT: Expense Account
      const expenseRef = doc(firestore, 'accounts', selectedExpenseAccountId);
      batch.update(expenseRef, { balance: increment(amount) });

      await batch.commit();

      toast({ title: "Bill Saved", description: `Recorded $${amount} payable to ${selectedVendor.name}` });
      setIsOpen(false);
      setFormData({ ...formData, amount: '', invoiceNumber: '', description: '' });
      setSelectedVendor(null);

    } catch (error: any) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {triggerButton || (
           <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="mr-2 h-4 w-4" /> Enter Bill
           </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
             <Receipt className="h-5 w-5 text-emerald-600" /> Enter Vendor Bill
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-6 py-4">
           {/* ROW 1: Context */}
           <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                 <Label>Property *</Label>
                 <Select onValueChange={setSelectedPropertyId} value={selectedPropertyId}>
                    <SelectTrigger><SelectValue placeholder="Select Property..." /></SelectTrigger>
                    <SelectContent>
                       {properties.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                       ))}
                    </SelectContent>
                 </Select>
              </div>
              <div className="grid gap-2">
                 <Label>Vendor *</Label>
                 <VendorSelector onSelect={setSelectedVendor} />
                 {selectedVendor && <div className="text-xs text-muted-foreground mt-1">Selected: {selectedVendor.name}</div>}
              </div>
           </div>

           {/* ROW 2: Money & Category */}
           <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                 <Label>Amount Due ($) *</Label>
                 <Input 
                    type="number" 
                    placeholder="0.00" 
                    value={formData.amount}
                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                 />
              </div>
              <div className="grid gap-2">
                 <Label>Expense Category *</Label>
                 <Select onValueChange={setSelectedExpenseAccountId} value={selectedExpenseAccountId} disabled={!selectedPropertyId}>
                    <SelectTrigger>
                       <SelectValue placeholder={!selectedPropertyId ? "Select Property First" : "Select Account..."} />
                    </SelectTrigger>
                    <SelectContent>
                       {propertyAccounts.map(acc => (
                          <SelectItem key={acc.id} value={acc.id}>
                             {acc.name.replace(` - ${properties.find(p=>p.id===selectedPropertyId)?.name}`, '')} 
                          </SelectItem>
                       ))}
                    </SelectContent>
                 </Select>
                 {selectedVendor?.defaultCategory && (
                    <p className="text-[10px] text-muted-foreground">
                       Vendor default: {selectedVendor.defaultCategory}
                    </p>
                 )}
              </div>
           </div>

           {/* ROW 3: Dates */}
           <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                 <Label>Bill Date</Label>
                 <DatePicker date={formData.date} setDate={(d) => d && setFormData({...formData, date: d})} />
              </div>
              <div className="grid gap-2">
                 <Label>Due Date</Label>
                 <DatePicker date={formData.dueDate} setDate={(d) => d && setFormData({...formData, dueDate: d})} />
              </div>
           </div>

           {/* ROW 4: Details */}
            <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                <Label>Invoice # (Optional)</Label>
                <Input 
                    placeholder="INV-123" 
                    value={formData.invoiceNumber}
                    onChange={(e) => setFormData({...formData, invoiceNumber: e.target.value})}
                />
                </div>
                <div className="grid gap-2">
                <Label>Description / Memo</Label>
                <Input 
                    placeholder="e.g. Fixed leak in bathroom" 
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                />
                </div>
            </div>
        </div>

        <DialogFooter>
           <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
           <Button onClick={handleSubmit} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Bill"}
           </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DatePicker({ date, setDate }: { date: Date, setDate: (d: Date | undefined) => void }) {
   return (
     <Popover>
       <PopoverTrigger asChild>
         <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
           <CalendarIcon className="mr-2 h-4 w-4" />
           {date ? format(date, "PPP") : <span>Pick a date</span>}
         </Button>
       </PopoverTrigger>
       <PopoverContent className="w-auto p-0">
         <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
       </PopoverContent>
     </Popover>
   );
}
