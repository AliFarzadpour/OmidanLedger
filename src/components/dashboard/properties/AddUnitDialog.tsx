'use client';

import { useState } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Plus, Loader2 } from 'lucide-react';

interface AddUnitDialogProps {
  propertyId: string;
  onUnitAdded: () => void;
}

export function AddUnitDialog({ propertyId, onUnitAdded }: AddUnitDialogProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [unitName, setUnitName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleAddNewUnit = async () => {
    if (!user || !firestore || !unitName.trim()) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Unit name cannot be empty.',
      });
      return;
    }
    setIsLoading(true);

    try {
      const unitsCollection = collection(firestore, 'properties', propertyId, 'units');
      await addDoc(unitsCollection, {
        userId: user.uid,
        unitNumber: unitName.trim(),
        status: 'vacant',
        createdAt: serverTimestamp(),
        bedrooms: 0,
        bathrooms: 0,
        sqft: 0,
        amenities: [],
        financials: {
          rent: 0,
          deposit: 0,
        },
      });

      toast({
        title: 'Unit Added',
        description: `Unit "${unitName}" has been successfully created.`,
      });

      onUnitAdded(); // Trigger refetch on parent page
      setUnitName('');
      setIsOpen(false);
    } catch (error: any) {
      console.error('Error adding new unit:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to add the new unit.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Plus className="h-4 w-4" />
          New Unit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a New Unit</DialogTitle>
          <DialogDescription>
            Create a single new unit for this property. You can edit the details later.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-4">
          <Label htmlFor="unit-name">Unit Number or Name</Label>
          <Input
            id="unit-name"
            placeholder="e.g., 204, or Suite B"
            value={unitName}
            onChange={(e) => setUnitName(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button onClick={handleAddNewUnit} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Unit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
