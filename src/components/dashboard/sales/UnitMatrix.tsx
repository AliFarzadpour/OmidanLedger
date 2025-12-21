'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bed, Bath, Square, Users, DollarSign } from 'lucide-react';
import { UnitDetailDrawer } from '@/components/dashboard/sales/UnitDetailDrawer';

export function UnitMatrix({ propertyId, units, onUpdate }: { propertyId: string, units: any[], onUpdate: () => void }) {
  const [selectedUnit, setSelectedUnit] = useState<any>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleUnitClick = (unit: any) => {
    setSelectedUnit(unit);
    setIsDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setIsDrawerOpen(false);
    setSelectedUnit(null);
  };
  
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {units?.map((unit: any) => {
          const isOccupied = unit.tenants && unit.tenants.length > 0;
          const tenantName = isOccupied ? `${unit.tenants[0].firstName} ${unit.tenants[0].lastName}`.trim() : 'No Tenant';
          const rentAmount = isOccupied ? unit.tenants[0].rentAmount : (unit.financials?.rent || 0);

          return (
            <Card 
              key={unit.id} 
              onClick={() => handleUnitClick(unit)}
              className="hover:shadow-md transition-all cursor-pointer border-l-4 border-l-slate-200 hover:border-l-blue-500"
            >
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <Badge variant={isOccupied ? 'default' : 'destructive'}>
                  {isOccupied ? 'Occupied' : 'Vacant'}
                </Badge>
                <span className="text-sm font-mono font-bold text-slate-500">#{unit.unitNumber}</span>
              </CardHeader>
              
              <CardContent className="space-y-3">
                {/* 1. Primary Stats: Bed/Bath/SqFt */}
                <div className="flex items-center gap-3 text-xs text-slate-600 font-medium">
                  <div className="flex items-center gap-1">
                    <Bed className="h-3 w-3" /> {unit.bedrooms || 0}
                  </div>
                  <div className="flex items-center gap-1">
                    <Bath className="h-3 w-3" /> {unit.bathrooms || 0}
                  </div>
                  <div className="flex items-center gap-1 border-l pl-3">
                    <Square className="h-3 w-3" /> {unit.sqft?.toLocaleString() || 0} <span className="text-[10px]">sqft</span>
                  </div>
                </div>

                {/* 2. Tenant & Rent Info */}
                <div className="pt-2 border-t space-y-1">
                  <div className="flex justify-between items-center text-xs">
                     <span className="text-muted-foreground font-medium flex items-center gap-1"><Users className="h-3 w-3"/> Tenant</span>
                     <span className="font-medium truncate">{tenantName}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground font-medium flex items-center gap-1"><DollarSign className="h-3 w-3"/> Monthly Rent</span>
                    <span className="font-bold text-blue-600">
                      ${rentAmount.toLocaleString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {selectedUnit && (
        <UnitDetailDrawer 
          propertyId={propertyId}
          unit={selectedUnit}
          isOpen={isDrawerOpen}
          onOpenChange={handleDrawerClose}
          onUpdate={onUpdate}
        />
      )}
    </>
  );
}
