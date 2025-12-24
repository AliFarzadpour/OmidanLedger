
'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { writeBatch, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { learnCategoryMapping } from '@/ai/flows/learn-category-mapping';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import type { Transaction } from '../transactions-table';

interface BatchEditDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  transactions: Transaction[];
  dataSource: { id: string; accountName: string };
  onSuccess: () => void;
}

export function BatchEditDialog({ isOpen, onOpenChange, transactions, dataSource, onSuccess }: BatchEditDialogProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const [primaryCategory, setPrimaryCategory] = useState('');
  const [secondaryCategory, setSecondaryCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [details, setDetails] = useState('');
  const [ruleName, setRuleName] = useState('');

  // Pre-populate the fields when the dialog opens with a new set of transactions
  useEffect(() => {
    if (isOpen && transactions.length > 0) {
      const firstTx = transactions[0];
      setPrimaryCategory(firstTx.primaryCategory || 'Expenses');
      setSecondaryCategory(firstTx.secondaryCategory || '');
      setSubcategory(firstTx.subcategory || '');
      setDetails(firstTx.details || '');
      setRuleName(''); // Always reset the rule name
    }
  }, [transactions, isOpen]);


  const handleBatchUpdate = async () => {
    if (!user || !firestore || transactions.length === 0) return;
    if (!primaryCategory || !secondaryCategory || !subcategory) {
      toast({ variant: 'destructive', title: 'Missing Fields', description: 'Please fill out all three main category levels.' });
      return;
    }
    
    setIsSaving(true);
    try {
      const batch = writeBatch(firestore);
      transactions.forEach(tx => {
        const txRef = doc(firestore, `users/${user.uid}/bankAccounts/${dataSource.id}/transactions`, tx.id);
        batch.update(txRef, {
          primaryCategory,
          secondaryCategory,
          subcategory,
          details,
          status: 'posted',
          aiExplanation: 'Manually updated in batch.',
          reviewStatus: 'approved'
        });
      });
      await batch.commit();

      const keywordForRule = ruleName.trim();
      if (keywordForRule) {
        await learnCategoryMapping({
            transactionDescription: keywordForRule,
            primaryCategory,
            secondaryCategory,
            subcategory,
            userId: user.uid,
        });
        toast({
          title: 'Update & Rule Created',
          description: `${transactions.length} transactions updated and a new rule for "${keywordForRule}" was saved.`,
        });
      } else {
        toast({
          title: 'Batch Update Successful',
          description: `${transactions.length} transactions have been re-categorized.`,
        });
      }
      
      onOpenChange(false);
      onSuccess();
      
    } catch (error: any) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Batch Edit Transactions</DialogTitle>
          <DialogDescription>
            You are re-categorizing <strong>{transactions.length}</strong> transactions. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="primary">Primary Category (Level 0)</Label>
            <Input id="primary" value={primaryCategory} onChange={(e) => setPrimaryCategory(e.target.value)} placeholder="e.g., Expenses" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="secondary">Financial Category (Level 1)</Label>
            <Input id="secondary" value={secondaryCategory} onChange={(e) => setSecondaryCategory(e.target.value)} placeholder="e.g., Repairs" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sub">Tax Category (Level 2)</Label>
            <Input id="sub" value={subcategory} onChange={(e) => setSubcategory(e.target.value)} placeholder="e.g., Line 14 Repairs" />
          </div>
           <div className="grid gap-2">
            <Label htmlFor="details">Details (Level 3 - Optional)</Label>
            <Input id="details" value={details} onChange={(e) => setDetails(e.target.value)} placeholder="e.g., Adelyn - HVAC Repair" />
          </div>

          <div className="border-t pt-4 space-y-2">
             <Label htmlFor="ruleName">Create Rule from Selection (Optional)</Label>
             <Input 
                id="ruleName" 
                value={ruleName} 
                onChange={(e) => setRuleName(e.target.value)} 
                placeholder="Confirm by re-typing the vendor name" 
            />
             <p className="text-xs text-muted-foreground">
                If a vendor name is provided, a new Smart Rule will be created for it.
             </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleBatchUpdate} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Apply Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    