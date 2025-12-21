'use client';

import { useState } from 'react';
import { useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Home, Users, DollarSign, Loader2 } from 'lucide-react';
import { UnitDetailDrawer } from './UnitDetailDrawer';

export function UnitMatrix({ propertyId, units }: { propertyId: string, units: any[] }) {
  const { user } = useUser();
  const firestore = useFirestore();

  const [selectedUnit, setSelectedUnit] = useState<any>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // The collection hook is now in the parent, so we just handle UI state here.
  // This makes the component more reusable and controllable.

  const handleUnitClick = (unit: any) => {
    setSelectedUnit(unit);
    setIsDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setIsDrawerOpen(false);
    setSelectedUnit(null);
  };
  
  const handleUpdateSuccess = () => {
      // Future logic to refresh data can be triggered here if needed,
      // but real-time listeners in the parent handle it automatically.
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {units?.map((unit: any) => (
          <Card 
            key={unit.id} 
            className="hover:border-blue-500 transition-colors cursor-pointer" 
            onClick={() => handleUnitClick(unit)}
          >
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <Badge variant={unit.status === 'vacant' ? 'destructive' : 'default'}>
                  {unit.status}
                </Badge>
                <span className="text-xs font-bold text-muted-foreground">#{unit.unitNumber}</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-3 w-3" />
                  <span>{unit.tenantName || 'No Tenant'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <DollarSign className="h-3 w-3" />
                  <span>{(unit.targetRent || 0).toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {selectedUnit && (
        <UnitDetailDrawer 
          propertyId={propertyId}
          unit={selectedUnit}
          isOpen={isDrawerOpen}
          onOpenChange={handleDrawerClose}
          onUpdate={handleUpdateSuccess}
        />
      )}
    </>
  );
}
