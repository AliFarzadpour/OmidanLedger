
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

export function UnitDetailDrawer({ propertyId, unit, isOpen, onOpenChange }: any) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !unit) return;
    setIsSaving(true);

    const formData = new FormData(e.currentTarget);
    const unitRef = doc(firestore, 'properties', propertyId, 'units', unit.id);

    try {
      await updateDoc(unitRef, {
        bedrooms: Number(formData.get('bedrooms')),
        bathrooms: Number(formData.get('bathrooms')),
        sqft: Number(formData.get('sqft')),
        targetRent: Number(formData.get('targetRent')),
        securityDeposit: Number(formData.get('securityDeposit')),
        amenities: formData.get('amenities')?.toString().split(',').map(s => s.trim()) || []
      });
      toast({ title: "Unit Updated", description: `Unit ${unit.unitNumber} details saved.` });
      onOpenChange(false);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Update Failed", description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[400px]">
        <SheetHeader>
          <SheetTitle>Unit {unit?.unitNumber} Configuration</SheetTitle>
          <SheetDescription>Set the unique footprint and financial targets for this unit.</SheetDescription>
        </SheetHeader>
        
        <form onSubmit={handleUpdate} className="space-y-6 pt-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Bedrooms</Label><Input name="bedrooms" type="number" defaultValue={unit?.bedrooms || 0} /></div>
            <div className="space-y-2"><Label>Bathrooms</Label><Input name="bathrooms" type="number" defaultValue={unit?.bathrooms || 0} /></div>
          </div>
          
          <div className="space-y-2"><Label>Square Footage</Label><Input name="sqft" type="number" defaultValue={unit?.sqft || 0} /></div>
          
          <div className="grid grid-cols-2 gap-4 border-t pt-4">
            <div className="space-y-2"><Label>Target Rent ($)</Label><Input name="targetRent" type="number" defaultValue={unit?.targetRent || 0} /></div>
            <div className="space-y-2"><Label>Deposit ($)</Label><Input name="securityDeposit" type="number" defaultValue={unit?.securityDeposit || 0} /></div>
          </div>

          <div className="space-y-2"><Label>Amenities (comma separated)</Label><Input name="amenities" placeholder="Balcony, AC, Parking" defaultValue={unit?.amenities?.join(', ')} /></div>

          <Button type="submit" className="w-full bg-blue-600" disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Unit Details"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
