'use client';

import { useState } from 'react';
import { useFirestore, useCollection, useUser, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Home, Users, DollarSign, Loader2 } from 'lucide-react';
import { UnitDetailDrawer } from './UnitDetailDrawer';

export function UnitMatrix({ propertyId }: { propertyId: string }) {
  const { user } = useUser();
  const firestore = useFirestore();

  const [selectedUnit, setSelectedUnit] = useState<any>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Query the subcollection we just built in the QuickSetup
  const unitsQuery = useMemoFirebase(() => {
    if (!firestore || !propertyId) return null;
    return query(collection(firestore, 'properties', propertyId, 'units'));
  }, [firestore, propertyId]);
  

  const { data: units, isLoading, refetch } = useCollection(unitsQuery);

  const handleUnitClick = (unit: any) => {
    setSelectedUnit(unit);
    setIsDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setIsDrawerOpen(false);
    setSelectedUnit(null);
  };

  if (isLoading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>;

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {units?.map((unit: any) => (
          <Card key={unit.id} className="hover:border-blue-500 transition-colors cursor-pointer" onClick={() => handleUnitClick(unit)}>
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
          onUpdate={refetch}
        />
      )}
    </>
  );
}
