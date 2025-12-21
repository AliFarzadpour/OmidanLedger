'use client';

import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export function UnitDetailDrawer({ propertyId, unit, isOpen, onOpenChange, onUpdate }: any) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [tenantName, setTenantName] = useState(unit?.tenantName || '');
  const [rent, setRent] = useState(unit?.targetRent || '');

  // Effect to sync state when the selected unit changes
  useState(() => {
    if (unit) {
      setTenantName(unit.tenantName || '');
      setRent(unit.targetRent || '');
    }
  });


  const handleUpdate = async (e: any) => {
    e.preventDefault();
    if (!firestore) return;
    setLoading(true);

    const unitRef = doc(firestore, 'properties', propertyId, 'units', unit.id);

    try {
      await updateDoc(unitRef, {
        tenantName: tenantName,
        targetRent: Number(rent),
        status: tenantName ? 'occupied' : 'vacant'
      });
      toast({ title: "Unit Updated", description: `Unit ${unit.unitNumber} has been saved.` });
      if(onUpdate) onUpdate();
      onOpenChange(false);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Update Failed", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit Unit {unit?.unitNumber}</SheetTitle>
          <SheetDescription>Update tenant information and rent for this specific unit.</SheetDescription>
        </SheetHeader>
        <form onSubmit={handleUpdate} className="space-y-4 mt-6">
          <div className="space-y-2">
            <Label>Tenant Name</Label>
            <Input name="tenantName" value={tenantName} onChange={e => setTenantName(e.target.value)} placeholder="John Doe" />
          </div>
          <div className="space-y-2">
            <Label>Monthly Rent ($)</Label>
            <Input name="rent" type="number" value={rent} onChange={e => setRent(e.target.value)} />
          </div>
          <Button type="submit" className="w-full bg-blue-600" disabled={loading}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : "Save Changes"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
