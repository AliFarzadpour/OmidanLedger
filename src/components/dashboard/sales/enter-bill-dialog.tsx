'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, getDocs, doc, writeBatch, serverTimestamp } from 'firebase/firestore'; 
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Loader2, Plus, Receipt } from 'lucide-react';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { recordManualPayment } from '@/actions/record-payment';

export function EnterBillDialog({ triggerButton }: { triggerButton?: React.ReactNode }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Data Sources
  const [tenants, setTenants] = useState<any[]>([]);
  
  // Form State
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Zelle');
  const [date, setDate] = useState(new Date());

  useEffect(() => {
    if (!isOpen || !user || !firestore) return;
    
    const loadTenants = async () => {
      const q = query(collection(firestore, 'users'), where('landlordId', '==', user.uid), where('role', '==', 'tenant'));
      const snap = await getDocs(q);
      setTenants(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };

    loadTenants();
  }, [isOpen, user, firestore]);

  const handleSubmit = async () => {
    const selectedTenant = tenants.find(t => t.id === selectedTenantId);
    if (!user || !selectedTenant) {
      toast({ variant: 'destructive', title: 'Missing Info', description: 'Please select a tenant.' });
      return;
    }

    setIsSaving(true);
    try {
      await recordManualPayment({
        tenantId: selectedTenant.id,
        propertyId: selectedTenant.associatedPropertyId,
        landlordId: user.uid,
        amount: Number(amount),
        method,
        date: date.toISOString(),
      });
      toast({ title: 'Payment Recorded', description: 'Ledger and tenant balance updated.' });
      setIsOpen(false);
      // Reset form
      setSelectedTenantId('');
      setAmount('');
      setMethod('Zelle');
      setDate(new Date());

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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
             <Receipt className="h-5 w-5 text-emerald-600" /> Record Manual Payment
          </DialogTitle>
          <DialogDescription>
            Log a payment received outside of the platform (e.g. Zelle, Cash, Check).
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-6 py-4">
           <div className="grid gap-2">
              <Label>Tenant *</Label>
              <Select onValueChange={setSelectedTenantId} value={selectedTenantId}>
                 <SelectTrigger><SelectValue placeholder="Select Tenant..." /></SelectTrigger>
                 <SelectContent>
                    {tenants.map(t => (
                       <SelectItem key={t.id} value={t.id}>{t.email}</SelectItem>
                    ))}
                 </SelectContent>
              </Select>
           </div>

           <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                 <Label>Amount ($) *</Label>
                 <Input 
                    type="number" 
                    placeholder="0.00" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                 />
              </div>
              <div className="grid gap-2">
                 <Label>Payment Method *</Label>
                 <Select onValueChange={setMethod} value={method}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Zelle">Zelle</SelectItem>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="Check">Check</SelectItem>
                      <SelectItem value="Venmo">Venmo</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                 </Select>
              </div>
           </div>

           <div className="grid gap-2">
              <Label>Payment Date</Label>
              <DatePicker date={date} setDate={(d) => d && setDate(d)} />
           </div>
        </div>

        <DialogFooter>
           <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
           <Button onClick={handleSubmit} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Record Payment"}
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
