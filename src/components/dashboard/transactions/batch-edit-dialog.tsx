
'use client';

import * as React from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, writeBatch, collection, query, where } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Label } from '../ui/label';

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

  const propertiesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'properties'), where('userId', '==', user.uid));
  }, [user, firestore]);
  const { data: properties, isLoading: isLoadingProperties } = useCollection(propertiesQuery);

  const handleSave = async () => {
    if (!user || !firestore || transactions.length === 0) return;
    if (!costCenter && !reviewStatus) {
        toast({ variant: 'destructive', title: 'No action selected', description: 'Please choose a property or status to apply.' });
        return;
    }

    setIsSaving(true);
    const batch = writeBatch(firestore);

    transactions.forEach(tx => {
        if (tx.bankAccountId) {
            const txRef = doc(firestore, `users/${user.uid}/bankAccounts/${tx.bankAccountId}/transactions/${tx.id}`);
            const updates: any = {};
            if (costCenter) updates.costCenter = costCenter;
            if (reviewStatus) updates.reviewStatus = reviewStatus;
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

        <div className="py-4 space-y-4">
           <div className="space-y-2">
                <Label>Assign to Property (Cost Center)</Label>
                <Select value={costCenter} onValueChange={setCostCenter}>
                    <SelectTrigger disabled={isLoadingProperties}>
                        <SelectValue placeholder="Select a property..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="">-- No Change --</SelectItem>
                        <SelectItem value="--clear--">Unassign (Clear Cost Center)</SelectItem>
                        {properties?.map((p: any) => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
           </div>
           <div className="space-y-2">
                <Label>Set Review Status</Label>
                <Select value={reviewStatus} onValueChange={setReviewStatus}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select a status..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="">-- No Change --</SelectItem>
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
