
'use client';

import * as React from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, writeBatch, collection, query, where } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { CATEGORY_MAP, L0Category } from '@/lib/categories';

function HierarchicalCategorySelector({ l0, setL0, l1, setL1, l2, setL2 }: {
  l0: string; setL0: (val: string) => void;
  l1: string; setL1: (val: string) => void;
  l2: string; setL2: (val: string) => void;
}) {
  const l1Options = l0 && CATEGORY_MAP[l0 as L0Category] ? Object.keys(CATEGORY_MAP[l0 as L0Category]) : [];
  const l2Options = (l0 && l1 && CATEGORY_MAP[l0 as L0Category] && (CATEGORY_MAP[l0 as L0Category] as any)[l1]) ? (CATEGORY_MAP[l0 as L0Category] as any)[l1] : [];

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="l0">L0</Label>
        <Select value={l0} onValueChange={val => { setL0(val); setL1(''); setL2(''); }}>
            <SelectTrigger id="l0" className="col-span-3 h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
                {Object.keys(CATEGORY_MAP).map(key => <SelectItem key={key} value={key}>{key}</SelectItem>)}
            </SelectContent>
        </Select>
      </div>
       <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="l1">L1</Label>
        <Select value={l1} onValueChange={val => { setL1(val); setL2(''); }} disabled={!l0}>
            <SelectTrigger id="l1" className="col-span-3 h-8"><SelectValue placeholder="Select L1..." /></SelectTrigger>
            <SelectContent>
                {l1Options.map((key: string) => <SelectItem key={key} value={key}>{key}</SelectItem>)}
            </SelectContent>
        </Select>
      </div>
       <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="l2">L2</Label>
        <Select value={l2} onValueChange={val => { setL2(val); }} disabled={!l1}>
            <SelectTrigger id="l2" className="col-span-3 h-8"><SelectValue placeholder="Select L2..." /></SelectTrigger>
            <SelectContent>
                {l2Options.map((opt: string) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
        </Select>
      </div>
    </div>
  );
}


export function BatchEditDialog({
  isOpen,
  onOpenChange,
  transactions,
  onSuccess,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  transactions: any[];
  onSuccess: () => void;
}) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = React.useState(false);
  
  // State for form fields
  const [costCenter, setCostCenter] = React.useState('');
  const [reviewStatus, setReviewStatus] = React.useState('');
  const [l0, setL0] = React.useState('');
  const [l1, setL1] = React.useState('');
  const [l2, setL2] = React.useState('');


  const propertiesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'properties'), where('userId', '==', user.uid));
  }, [user, firestore]);
  const { data: properties, isLoading: isLoadingProperties } = useCollection(propertiesQuery);

  const handleSave = async () => {
    if (!user || !firestore || transactions.length === 0) return;
    const hasChanges = costCenter || reviewStatus || (l0 && l1 && l2);
    if (!hasChanges) {
        toast({ variant: 'destructive', title: 'No action selected', description: 'Please choose a property, status, or category to apply.' });
        return;
    }

    setIsSaving(true);
    const batch = writeBatch(firestore);

    transactions.forEach(tx => {
        if (tx.bankAccountId) {
            const txRef = doc(firestore, `users/${user.uid}/bankAccounts/${tx.bankAccountId}/transactions`, tx.id);
            const updates: any = {};
            if (costCenter) updates.costCenter = costCenter === '--clear--' ? null : costCenter;
            if (reviewStatus) updates.reviewStatus = reviewStatus;
            if (l0 && l1 && l2) {
                updates.categoryHierarchy = { l0, l1, l2, l3: tx.categoryHierarchy.l3 || '' };
            }
            batch.update(txRef, updates);
        }
    });

    try {
        await batch.commit();
        toast({ title: 'Batch Update Successful', description: `${transactions.length} transactions have been updated.`});
        onSuccess();
        onOpenChange(false);
    } catch (error: any) {
        console.error("Batch update failed:", error);
        toast({ variant: 'destructive', title: 'Update Failed', description: error.message });
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Batch Edit {transactions.length} Transactions</DialogTitle>
          <DialogDescription>Apply changes to all selected items. Leave fields blank to keep existing values.</DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-6">
           <div className="space-y-2">
                <Label>Assign to Property (Cost Center)</Label>
                <Select value={costCenter} onValueChange={setCostCenter}>
                    <SelectTrigger disabled={isLoadingProperties}>
                        <SelectValue placeholder="Select a property..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="--no-change--">-- No Change --</SelectItem>
                        <SelectItem value="--clear--">Unassign (Clear Cost Center)</SelectItem>
                        {properties?.map((p: any) => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
           </div>
           
           <div className="space-y-2">
                <Label>Assign New Category</Label>
                <HierarchicalCategorySelector l0={l0} setL0={setL0} l1={l1} setL1={setL1} l2={l2} setL2={setL2} />
           </div>

           <div className="space-y-2">
                <Label>Set Review Status</Label>
                <Select value={reviewStatus} onValueChange={setReviewStatus}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select a status..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="--no-change--">-- No Change --</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="needs-review">Needs Review</SelectItem>
                        <SelectItem value="incorrect">Incorrect</SelectItem>
                    </SelectContent>
                </Select>
           </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
            Apply Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
