
'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { writeBatch, doc, collection, getDocs, query, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { learnCategoryMapping } from '@/ai/flows/learn-category-mapping';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, PlusCircle } from 'lucide-react';
import type { Transaction } from '../reports/audit/types';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CATEGORY_MAP, L0Category, L1Category, L2Category } from '@/lib/categories';

interface BatchEditDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  transactions: Transaction[];
  onSuccess: () => void;
}

interface Property {
    id: string;
    name: string;
    units: { id: string; unitNumber: string; }[]
}

function HierarchicalCategorySelector({ l0, setL0, l1, setL1, l2, setL2 }: {
  l0: string; setL0: (val: string) => void;
  l1: string; setL1: (val: string) => void;
  l2: string; setL2: (val: string) => void;
}) {
  const [customL1, setCustomL1] = useState('');
  const [customL2, setCustomL2] = useState('');
  
  const l1Options = l0 ? Object.keys(CATEGORY_MAP[l0 as L0Category] || {}) : [];
  const l2Options = (l0 && l1 && CATEGORY_MAP[l0 as L0Category] && (CATEGORY_MAP[l0 as L0Category] as any)[l1]) ? (CATEGORY_MAP[l0 as L0Category] as any)[l1] : [];

  useEffect(() => {
    if (customL1) setL1(customL1);
  }, [customL1, setL1]);

  useEffect(() => {
    if (customL2) setL2(customL2);
  }, [customL2, setL2]);


  return (
    <div className="space-y-4 p-4 border bg-muted/50 rounded-lg">
        <div className="grid gap-2">
            <Label htmlFor="l0">Primary Category (L0)</Label>
            <Select value={l0} onValueChange={val => { setL0(val); setL1(''); setL2(''); }}>
                <SelectTrigger id="l0"><SelectValue /></SelectTrigger>
                <SelectContent>
                    {Object.keys(CATEGORY_MAP).map(key => <SelectItem key={key} value={key}>{key}</SelectItem>)}
                </SelectContent>
            </Select>
        </div>
        <div className="grid gap-2">
            <Label htmlFor="l1">Financial Category (L1)</Label>
            <div className="flex gap-2">
                <Select value={l1} onValueChange={val => { setL1(val); setL2(''); setCustomL1(''); }} disabled={!l0}>
                    <SelectTrigger id="l1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {l1Options.map((key: string) => <SelectItem key={key} value={key}>{key}</SelectItem>)}
                        <SelectItem value="--add-new--">...Add New L1</SelectItem>
                    </SelectContent>
                </Select>
                {l1 === '--add-new--' && <Input placeholder="New L1 Category" value={customL1} onChange={e => setCustomL1(e.target.value)} />}
            </div>
        </div>
        <div className="grid gap-2">
            <Label htmlFor="l2">Tax Category (L2)</Label>
            <div className="flex gap-2">
                <Select value={l2} onValueChange={val => { setL2(val); setCustomL2(''); }} disabled={!l1 || l1 === '--add-new--'}>
                    <SelectTrigger id="l2"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {l2Options.map((opt: string) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                         <SelectItem value="--add-new--">...Add New L2</SelectItem>
                    </SelectContent>
                </Select>
                 {l2 === '--add-new--' && <Input placeholder="New L2 Category" value={customL2} onChange={e => setCustomL2(e.target.value)} />}
            </div>
        </div>
    </div>
  );
}


export function BatchEditDialog({ isOpen, onOpenChange, transactions, onSuccess }: BatchEditDialogProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  // Category State
  const [l0, setL0] = useState('');
  const [l1, setL1] = useState('');
  const [l2, setL2] = useState('');
  const [l3, setL3] = useState('');

  const [ruleName, setRuleName] = useState('');
  const [costCenter, setCostCenter] = useState('');
  const [properties, setProperties] = useState<Property[]>([]);

  useEffect(() => {
    async function fetchProperties() {
        if (!user || !firestore || !isOpen) return;

        const propsQuery = query(collection(firestore, 'properties'), where('userId', '==', user.uid));
        const propsSnap = await getDocs(propsQuery);
        const propsData: Property[] = [];
        for (const propDoc of propsSnap.docs) {
            const unitsSnap = await getDocs(collection(propDoc.ref, 'units'));
            propsData.push({
                id: propDoc.id,
                name: propDoc.data().name,
                units: unitsSnap.docs.map(unitDoc => ({ id: unitDoc.id, unitNumber: unitDoc.data().unitNumber }))
            });
        }
        setProperties(propsData);
    }
    fetchProperties();
  }, [user, firestore, isOpen]);


  useEffect(() => {
    if (isOpen && transactions.length > 0) {
      const firstTx = transactions[0];
      const cats = firstTx.categoryHierarchy || { l0: 'EXPENSE', l1: '', l2: '', l3: '' };
      setL0(cats.l0);
      setL1(cats.l1);
      setL2(cats.l2);
      setL3(cats.l3);
      setCostCenter(''); 
      setRuleName(''); 
    }
  }, [transactions, isOpen]);


  const handleBatchUpdate = async () => {
    if (!user || !firestore || transactions.length === 0) return;
    if (!l0 || !l1 || !l2) {
      toast({ variant: 'destructive', title: 'Missing Fields', description: 'Please fill out all three main category levels.' });
      return;
    }
    
    setIsSaving(true);
    try {
      const batch = writeBatch(firestore);
      transactions.forEach(tx => {
        if (!tx.bankAccountId) {
            console.warn(`Skipping transaction with missing bankAccountId: ${tx.id}`);
            return; 
        }
        const txRef = doc(firestore, `users/${user.uid}/bankAccounts/${tx.bankAccountId}/transactions`, tx.id);
        
        const updateData: any = {
          categoryHierarchy: { l0, l1, l2, l3 },
          status: 'posted',
          aiExplanation: 'Manually updated in batch.',
          reviewStatus: 'approved',
          auditStatus: 'audited'
        };
        
        if (costCenter) {
           updateData.costCenter = costCenter === 'No Cost Center' ? null : costCenter;
        }

        batch.update(txRef, updateData);
      });
      await batch.commit();

      const keywordForRule = ruleName.trim();
      if (keywordForRule) {
        await learnCategoryMapping({
            transactionDescription: keywordForRule,
            primaryCategory: l0,
            secondaryCategory: l1,
            subcategory: l2,
            details: l3,
            userId: user.uid,
            propertyId: costCenter && costCenter !== 'No Cost Center' ? costCenter : undefined
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
  
  const handleCostCenterChange = (value: string) => {
      setCostCenter(value);
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
            <Label htmlFor="costCenter">Cost Center (Property/Unit)</Label>
             <Select onValueChange={handleCostCenterChange} value={costCenter}>
                <SelectTrigger id="costCenter">
                    <SelectValue placeholder="Assign to a property or unit..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="No Cost Center">No Cost Center</SelectItem>
                    {properties.map(prop => (
                        <SelectGroup key={prop.id}>
                             <SelectItem value={prop.id}>{prop.name} (Building)</SelectItem>
                             {prop.units.map((unit: any) => (
                                 <SelectItem key={unit.id} value={unit.id}>&nbsp;&nbsp;&nbsp;↳ Unit {unit.unitNumber}</SelectItem>
                             ))}
                        </SelectGroup>
                    ))}
                </SelectContent>
             </Select>
          </div>

          <HierarchicalCategorySelector l0={l0} setL0={setL0} l1={l1} setL1={setL1} l2={l2} setL2={setL2} />

           <div className="grid gap-2">
            <Label htmlFor="l3">Details / Memo (L3 - Optional)</Label>
            <Input id="l3" value={l3} onChange={(e) => setL3(e.target.value)} placeholder="e.g., Adelyn - HVAC Repair" />
          </div>

          <div className="border-t pt-4 space-y-2">
             <Label htmlFor="ruleName">Create Rule from Selection (Optional)</Label>
             <Input 
                id="ruleName" 
                value={ruleName} 
                onChange={(e) => setRuleName(e.target.value)} 
                placeholder="Confirm by re-typing a common vendor name" 
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
