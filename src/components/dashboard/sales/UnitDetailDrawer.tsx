
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

  const [tenantName, setTenantName] = useState(unit?.tenantName || '');
  const [rent, setRent] = useState(unit?.targetRent || '');

  useEffect(() => {
    if (unit) {
      setTenantName(unit.tenantName || '');
      setRent(unit.targetRent || '');
    }
  }, [unit]);


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
        <div className="h-[calc(100vh-150px)] flex flex-col">
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
            
            <Separator className="my-6" />

            <div className="space-y-2">
                <h4 className="font-semibold">Actions</h4>
                {tenantName && user && (
                    <RecordPaymentModal
                        tenant={{ id: unit.id, rentAmount: rent, firstName: tenantName }} // Construct a mock tenant
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
