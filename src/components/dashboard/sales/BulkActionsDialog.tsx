'use client';

import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { updateUnitsInBulk } from '@/actions/unit-actions';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

interface BulkActionsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  selectedUnitIds: string[];
  onSuccess: () => void;
}

const ALL_AMENITIES = [
  "Stove", "Fridge", "Washer", "Dryer", "Dishwasher", "Microwave",
  "Balcony/Patio", "A/C", "Heating", "Parking", "Hardwood Floors", "Carpet"
];

export function BulkActionsDialog({
  isOpen,
  onOpenChange,
  propertyId,
  selectedUnitIds,
  onSuccess,
}: BulkActionsDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const [rent, setRent] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [bathrooms, setBathrooms] = useState('');
  const [sqft, setSqft] = useState('');
  const [amenities, setAmenities] = useState<string[]>([]);

  const handleAmenityChange = (amenity: string, checked: boolean) => {
    setAmenities(prev => 
      checked ? [...prev, amenity] : prev.filter(a => a !== amenity)
    );
  };

  const handleSave = async () => {
    setIsLoading(true);

    const updates: { [key: string]: any } = {};
    if (rent) updates['financials.rent'] = Number(rent);
    if (bedrooms) updates['bedrooms'] = Number(bedrooms);
    if (bathrooms) updates['bathrooms'] = Number(bathrooms);
    if (sqft) updates['sqft'] = Number(sqft);
    if (amenities.length > 0) updates['amenities'] = amenities;

    if (Object.keys(updates).length === 0) {
        toast({ variant: 'destructive', title: 'No Changes', description: 'Please fill out at least one field to update.' });
        setIsLoading(false);
        return;
    }

    try {
      await updateUnitsInBulk(propertyId, selectedUnitIds, updates);
      toast({
        title: 'Bulk Update Successful',
        description: `${selectedUnitIds.length} units have been updated.`,
      });
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Update Failed', description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bulk Edit {selectedUnitIds.length} Units</DialogTitle>
          <DialogDescription>
            Apply changes to all selected units. Only fill out the fields you want to change.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Bedrooms</Label>
              <Input type="number" placeholder="e.g., 2" value={bedrooms} onChange={e => setBedrooms(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Bathrooms</Label>
              <Input type="number" placeholder="e.g., 1" value={bathrooms} onChange={e => setBathrooms(e.target.value)} />
            </div>
             <div className="space-y-2">
              <Label>Sq. Footage</Label>
              <Input type="number" placeholder="e.g., 800" value={sqft} onChange={e => setSqft(e.target.value)} />
            </div>
          </div>
           <div className="space-y-2">
                <Label>Monthly Rent</Label>
                <Input type="number" placeholder="e.g., 1500" value={rent} onChange={e => setRent(e.target.value)} />
            </div>
          <div className="space-y-2 pt-4 border-t">
              <Label>Amenities</Label>
              <div className="grid grid-cols-3 gap-2">
                  {ALL_AMENITIES.map(amenity => (
                      <div key={amenity} className="flex items-center gap-2">
                          <Checkbox
                              id={`amenity-${amenity}`}
                              checked={amenities.includes(amenity)}
                              onCheckedChange={(checked) => handleAmenityChange(amenity, !!checked)}
                          />
                          <Label htmlFor={`amenity-${amenity}`} className="font-normal text-sm">{amenity}</Label>
                      </div>
                  ))}
              </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Apply to {selectedUnitIds.length} Units
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
