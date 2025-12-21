'use client';

import { useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, writeBatch } from 'firebase/firestore';
import { UnitMatrix } from '@/components/dashboard/sales/UnitMatrix';
import { PropertyDashboardSFH } from '@/components/dashboard/properties/PropertyDashboardSFH';
import { Loader2, ArrowLeft, Bot, Building, Plus, Edit } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { AddUnitDialog } from '@/components/dashboard/properties/AddUnitDialog';
import { PropertyForm } from '@/components/dashboard/sales/property-form';


function BulkOperationsDialog({ propertyId, units }: { propertyId: string, units: any[] }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [newRent, setNewRent] = useState('');

    const handleBulkRentSet = async () => {
        if (!firestore || !units || units.length === 0 || !newRent) return;
        setIsLoading(true);

        const rentValue = Number(newRent);
        const batch = writeBatch(firestore);
        
        units.forEach((unit: any) => {
            const unitRef = doc(firestore, 'properties', propertyId, 'units', unit.id);
            batch.update(unitRef, { 'financials.rent': rentValue });
        });

        try {
            await batch.commit();
            toast({ title: "Bulk Update Success", description: `All ${units.length} units set to $${rentValue}` });
            setIsOpen(false);
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Error", description: error.message });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                    <Bot className="h-4 w-4" />
                    Building Operations
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Bulk Building Operations</DialogTitle>
                    <DialogDescription>
                        Apply changes to all units in this building. This action cannot be undone.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="bulk-rent">Set Rent for All Units</Label>
                        <Input 
                            id="bulk-rent" 
                            type="number" 
                            placeholder="e.g., 1500" 
                            value={newRent}
                            onChange={(e) => setNewRent(e.target.value)}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                    <Button onClick={handleBulkRentSet} disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Apply to {units.length} Units
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


export default function PropertyDetailPage() {
  const firestore = useFirestore();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [formTab, setFormTab] = useState('general');

  const handleOpenDialog = (tab: string) => {
    setFormTab(tab);
    setIsEditOpen(true);
  }

  const propertyDocRef = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return doc(firestore, 'properties', id);
  }, [firestore, id]);

  const { data: property, isLoading: isLoadingProperty, refetch: refetchProperty } = useDoc(propertyDocRef);

  const unitsQuery = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return query(collection(firestore, 'properties', id, 'units'));
  }, [firestore, id]);

  const { data: units, isLoading: isLoadingUnits, refetch: refetchUnits } = useCollection(unitsQuery);

  const handleUnitUpdate = () => {
    refetchUnits();
  }

  if (isLoadingProperty || isLoadingUnits) {
    return (
      <div className="flex h-full w-full items-center justify-center p-20">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // --- THE INTERFACE ROUTER ---
  // If it's a multi-unit or commercial property, show the Central Hub (Unit Matrix)
  if (property?.isMultiUnit) {
    return (
        <>
      <div className="space-y-6 p-8">
        <header className="flex justify-between items-end">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/properties')}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                  <h1 className="text-3xl font-bold">{property.name} Central Hub</h1>
                  <p className="text-muted-foreground">{property.address.street}, {property.address.city}</p>
                </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => handleOpenDialog('general')}><Edit className="mr-2 h-4 w-4" /> Edit Settings</Button>
              {units && <BulkOperationsDialog propertyId={id} units={units} />}
              <AddUnitDialog propertyId={id} onUnitAdded={refetchUnits} />
            </div>
        </header>
        
        <UnitMatrix propertyId={id} units={units || []} onUpdate={handleUnitUpdate} />
      </div>

       <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Property Settings</DialogTitle>
            <DialogDescription>
              Update building-level details for {property.name}. Unit-specific details are managed in the unit drawer.
            </DialogDescription>
          </DialogHeader>
          <PropertyForm 
            initialData={{ id: property.id, ...property }} 
            onSuccess={() => { refetchProperty(); setIsEditOpen(false); }} 
            defaultTab={formTab} 
          />
        </DialogContent>
      </Dialog>
      </>
    );
  }

  // Otherwise, return your original Single Family interface
  return <PropertyDashboardSFH property={property} onUpdate={refetchProperty}/>;
}
