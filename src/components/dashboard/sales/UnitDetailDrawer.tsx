'use client';

import { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Hash } from 'lucide-react';

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
        unitNumber: formData.get('unitNumber'), // The critical editable field
        bedrooms: Number(formData.get('bedrooms')),
        bathrooms: Number(formData.get('bathrooms')),
        sqft: Number(formData.get('sqft')),
        targetRent: Number(formData.get('targetRent')),
        securityDeposit: Number(formData.get('securityDeposit')),
        amenities: formData.get('amenities')?.toString().split(',').map(s => s.trim()) || []
      });
      
      toast({ title: "Success", description: "Unit identity and details updated." });
      onOpenChange(false);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      {/* The key={unit?.id} forces the drawer to refresh its inputs when you switch units */}
      <SheetContent key={unit?.id} className="sm:max-w-[440px] overflow-y-auto">
        <SheetHeader className="border-b pb-4">
          <SheetTitle className="text-2xl font-black flex items-center gap-2 text-slate-900">
            <Hash className="h-6 w-6 text-blue-600" /> Unit Management
          </SheetTitle>
          <SheetDescription>
            Modify the physical identity and financial targets for this specific space.
          </SheetDescription>
        </SheetHeader>
        
        <form onSubmit={handleUpdate} className="space-y-8 pt-6">
          {/* SECTION 1: IDENTITY (THE MISSING EDITABLE PART) */}
          <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="space-y-2">
              <Label htmlFor="unitNumber" className="text-xs uppercase tracking-widest font-bold text-slate-500">
                Display Number / Label
              </Label>
              <Input 
                id="unitNumber"
                name="unitNumber" 
                defaultValue={unit?.unitNumber} 
                placeholder="e.g., 101, Penthouse, or Suite A"
                className="text-xl font-bold h-12 border-2 focus:border-blue-500 bg-white"
              />
              <p className="text-[10px] text-slate-400 italic">This name appears on the unit card in the central hub.</p>
            </div>
          </div>

          {/* SECTION 2: PHYSICAL SPECS */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2"><span className="w-1 h-4 bg-blue-500 rounded-full" /> Physical Stats</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label className="text-xs">Bedrooms</Label><Input name="bedrooms" type="number" defaultValue={unit?.bedrooms || 0} /></div>
              <div className="space-y-2"><Label className="text-xs">Bathrooms</Label><Input name="bathrooms" type="number" defaultValue={unit?.bathrooms || 0} /></div>
            </div>
            <div className="space-y-2"><Label className="text-xs">Square Footage</Label><Input name="sqft" type="number" defaultValue={unit?.sqft || 0} /></div>
            <div className="space-y-2"><Label className="text-xs">Amenities</Label><Input name="amenities" placeholder="e.g., Balcony, AC, Parking" defaultValue={unit?.amenities?.join(', ') || ''} /></div>
          </div>
          
          {/* SECTION 3: FINANCIALS */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2"><span className="w-1 h-4 bg-green-500 rounded-full" /> Financial Targets</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label className="text-xs">Target Rent ($)</Label><Input name="targetRent" type="number" defaultValue={unit?.financials?.rent || 0} /></div>
              <div className="space-y-2"><Label className="text-xs">Deposit ($)</Label><Input name="securityDeposit" type="number" defaultValue={unit?.financials?.deposit || 0} /></div>
            </div>
          </div>

          <div className="pt-4 border-t">
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-lg font-bold shadow-lg" disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Update Unit Identity"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
