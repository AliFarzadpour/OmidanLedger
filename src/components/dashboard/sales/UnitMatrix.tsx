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
        {units?.map((unit: any) => (
          <Card 
            key={unit.id} 
            onClick={() => handleUnitClick(unit)}
            className="hover:shadow-md transition-all cursor-pointer border-l-4 border-l-slate-200 hover:border-l-blue-500"
          >
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <Badge variant={unit.status === 'vacant' ? 'destructive' : 'default'}>
                {unit.status}
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
              <div className="pt-2 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Monthly Rent</span>
                  <span className="text-sm font-bold text-blue-600">
                    ${(unit.financials?.rent || unit.targetRent)?.toLocaleString() || '0'}
                  </span>
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
          onUpdate={onUpdate}
        />
      )}
    </>
  );
}
