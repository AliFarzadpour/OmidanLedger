'use client';

import { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { RecordPaymentModal } from './RecordPaymentModal';
import { Separator } from '@/components/ui/separator';

export function UnitDetailDrawer({ propertyId, unit, isOpen, onOpenChange, onUpdate }: any) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  // When a new unit is passed in, reset the form state
  useEffect(() => {
    if (unit) {
      // No need for separate states if using uncontrolled form with defaultValue
    }
  }, [unit]);

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !unit) return;
    setIsSaving(true);

    const formData = new FormData(e.currentTarget);
    const unitRef = doc(firestore, 'properties', propertyId, 'units', unit.id);

    try {
      await updateDoc(unitRef, {
        // THIS SAVES THE NEW NUMBER/NAME TO FIRESTORE
        unitNumber: formData.get('unitNumber'), 
        bedrooms: Number(formData.get('bedrooms')),
        bathrooms: Number(formData.get('bathrooms')),
        sqft: Number(formData.get('sqft')),
        'financials.rent': Number(formData.get('rent')),
        'financials.deposit': Number(formData.get('deposit')),
        amenities: formData.get('amenities')?.toString().split(',').map(s => s.trim()) || [],
        tenantName: formData.get('tenantName'),
        status: formData.get('tenantName') ? 'occupied' : 'vacant',
      });
      
      toast({ title: "Unit Updated", description: "Identity and details saved successfully." });
      if(onUpdate) onUpdate();
      onOpenChange(false);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Update Failed", description: error.message });
    } finally {
      setIsSaving(false);
    }
  };


  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Edit Unit {unit?.unitNumber}</SheetTitle>
          <SheetDescription>Update tenant information and unit specifications.</SheetDescription>
        </SheetHeader>
        <div className="h-[calc(100vh-150px)] overflow-y-auto pr-4">
            <form onSubmit={handleUpdate} className="space-y-6 mt-6">
                
                {/* EDITABLE UNIT NUMBER FIELD */}
                <div className="space-y-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <Label htmlFor="unitNumber" className="text-blue-700 font-bold">Unit Number / Name</Label>
                    <Input 
                        id="unitNumber"
                        name="unitNumber"
                        placeholder="e.g., 101, Apt A, or Suite 200" 
                        defaultValue={unit?.unitNumber} 
                        className="bg-white font-bold text-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-[10px] text-blue-600">Changing this will update the card on the main hub.</p>
                </div>

                <div className="space-y-2">
                    <Label>Tenant Name</Label>
                    <Input name="tenantName" defaultValue={unit?.tenantName} placeholder="John Doe" />
                </div>
                
                <Separator />
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Bedrooms</Label>
                    <Input name="bedrooms" type="number" defaultValue={unit?.bedrooms || ''} />
                  </div>
                  <div className="space-y-2">
                    <Label>Bathrooms</Label>
                    <Input name="bathrooms" type="number" defaultValue={unit?.bathrooms || ''} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Square Footage</Label>
                  <Input name="sqft" type="number" defaultValue={unit?.sqft || ''} />
                </div>

                <div className="space-y-2">
                  <Label>Amenities (comma separated)</Label>
                  <Input name="amenities" placeholder="Balcony, AC, Hardwood floors" defaultValue={Array.isArray(unit?.amenities) ? unit?.amenities.join(', ') : ''} />
                </div>

                <Separator />
                
                <div className="grid grid-cols-2 gap-4 border-t pt-4">
                  <div className="space-y-2">
                    <Label>Unit Rent ($)</Label>
                    <Input name="rent" type="number" defaultValue={unit?.financials?.rent || ''} />
                  </div>
                  <div className="space-y-2">
                    <Label>Unit Deposit ($)</Label>
                    <Input name="deposit" type="number" defaultValue={unit?.financials?.deposit || ''} />
                  </div>
                </div>

                <Button type="submit" className="w-full bg-blue-600" disabled={isSaving}>
                    {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : "Save Changes"}
                </Button>
            </form>
            
            <Separator className="my-6" />

            <div className="space-y-2">
                <h4 className="font-semibold">Actions</h4>
                {unit?.tenantName && user && (
                    <RecordPaymentModal
                        tenant={{ id: unit.id, rentAmount: unit?.financials?.rent, firstName: unit?.tenantName }} 
                        propertyId={propertyId}
                        unitId={unit.id}
                        landlordId={user.uid}
                    />
                )}
            </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}