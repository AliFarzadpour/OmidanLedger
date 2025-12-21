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
  const [loading, setLoading] = useState(false);

  // State for controlled components
  const [unitNumber, setUnitNumber] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [bathrooms, setBathrooms] = useState('');
  const [sqft, setSqft] = useState('');
  const [amenities, setAmenities] = useState('');
  const [rent, setRent] = useState('');
  const [deposit, setDeposit] = useState('');

  // When a new unit is passed in, reset the form state
  useEffect(() => {
    if (unit) {
      setUnitNumber(unit.unitNumber || '');
      setTenantName(unit.tenantName || '');
      setBedrooms(unit.bedrooms || '');
      setBathrooms(unit.bathrooms || '');
      setSqft(unit.sqft || '');
      setAmenities(Array.isArray(unit.amenities) ? unit.amenities.join(', ') : '');
      setRent(unit.financials?.rent || '');
      setDeposit(unit.financials?.deposit || '');
    }
  }, [unit]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !unit) return;
    setLoading(true);

    const unitRef = doc(firestore, 'properties', propertyId, 'units', unit.id);

    try {
      await updateDoc(unitRef, {
        unitNumber: unitNumber,
        tenantName: tenantName,
        status: tenantName ? 'occupied' : 'vacant',
        bedrooms: Number(bedrooms) || 0,
        bathrooms: Number(bathrooms) || 0,
        sqft: Number(sqft) || 0,
        amenities: amenities.split(',').map(a => a.trim()).filter(a => a),
        'financials.rent': Number(rent) || 0,
        'financials.deposit': Number(deposit) || 0,
      });
      toast({ title: "Unit Updated", description: `Unit ${unit.unitNumber} has been saved.` });
      if (onUpdate) onUpdate();
      onOpenChange(false);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Update Failed", description: error.message });
    } finally {
      setLoading(false);
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
                
                <div className="space-y-2">
                    <Label htmlFor="unitNumber" className="text-blue-600 font-bold">Unit Number / Name</Label>
                    <Input 
                      id="unitNumber"
                      name="unitNumber"
                      value={unitNumber} 
                      onChange={e => setUnitNumber(e.target.value)} 
                      placeholder="e.g., 101, Apt A, or Suite 200" 
                      className="border-blue-200 focus:border-blue-500 font-bold text-lg"
                    />
                </div>

                <div className="space-y-2">
                    <Label>Tenant Name</Label>
                    <Input value={tenantName} onChange={e => setTenantName(e.target.value)} placeholder="John Doe" />
                </div>
                
                <Separator />
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Bedrooms</Label>
                    <Input name="bedrooms" type="number" value={bedrooms} onChange={e => setBedrooms(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Bathrooms</Label>
                    <Input name="bathrooms" type="number" value={bathrooms} onChange={e => setBathrooms(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Square Footage</Label>
                  <Input name="sqft" type="number" value={sqft} onChange={e => setSqft(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>Amenities (comma separated)</Label>
                  <Input name="amenities" placeholder="Balcony, AC, Hardwood floors" value={amenities} onChange={e => setAmenities(e.target.value)} />
                </div>

                <Separator />
                
                <div className="grid grid-cols-2 gap-4 border-t pt-4">
                  <div className="space-y-2">
                    <Label>Unit Rent ($)</Label>
                    <Input name="rent" type="number" value={rent} onChange={e => setRent(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Unit Deposit ($)</Label>
                    <Input name="deposit" type="number" value={deposit} onChange={e => setDeposit(e.target.value)} />
                  </div>
                </div>

                <Button type="submit" className="w-full bg-blue-600" disabled={loading}>
                    {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : "Save Changes"}
                </Button>
            </form>
            
            <Separator className="my-6" />

            <div className="space-y-2">
                <h4 className="font-semibold">Actions</h4>
                {tenantName && user && (
                    <RecordPaymentModal
                        tenant={{ id: unit.id, rentAmount: rent, firstName: tenantName }} 
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
