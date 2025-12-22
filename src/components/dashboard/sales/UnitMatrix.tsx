'use client';

import { useState, useMemo } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bed, Bath, Square, Users, DollarSign, Search, ArrowDownUp, ArrowUp, ArrowDown } from 'lucide-react';
import { UnitDetailDrawer } from '@/components/dashboard/sales/UnitDetailDrawer';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

type SortKey = 'unitNumber' | 'status' | 'rentAmount';
type SortDirection = 'asc' | 'desc';

export function UnitMatrix({ propertyId, units, onUpdate }: { propertyId: string, units: any[], onUpdate: () => void }) {
  const [selectedUnit, setSelectedUnit] = useState<any>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  // State for filtering and sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('unitNumber');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleUnitClick = (unit: any) => {
    setSelectedUnit(unit);
    setIsDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setIsDrawerOpen(false);
    setSelectedUnit(null);
  };

  const filteredAndSortedUnits = useMemo(() => {
    if (!units) return [];

    let filtered = [...units];

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(unit => {
        const tenantName = unit.tenants?.[0]?.firstName ? `${unit.tenants[0].firstName} ${unit.tenants[0].lastName}` : '';
        return (
          unit.unitNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
          tenantName.toLowerCase().includes(searchTerm.toLowerCase())
        );
      });
    }

    // Sort the filtered units
    filtered.sort((a, b) => {
      let valA, valB;
      const rentA = a.tenants?.[0]?.rentAmount || a.financials?.rent || 0;
      const rentB = b.tenants?.[0]?.rentAmount || b.financials?.rent || 0;

      switch (sortBy) {
        case 'status':
          valA = a.tenants?.length > 0 ? 1 : 0; // Occupied = 1, Vacant = 0
          valB = b.tenants?.length > 0 ? 1 : 0;
          break;
        case 'rentAmount':
          valA = rentA;
          valB = rentB;
          break;
        case 'unitNumber':
        default:
          valA = a.unitNumber;
          valB = b.unitNumber;
          // Alphanumeric sorting for unit numbers
          return sortDirection === 'asc' 
            ? valA.localeCompare(valB, undefined, { numeric: true }) 
            : valB.localeCompare(valA, undefined, { numeric: true });
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [units, searchTerm, sortBy, sortDirection]);
  
  return (
    <>
      <div className="flex flex-col sm:flex-row gap-4 mb-6 p-4 bg-slate-50 border rounded-lg">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Filter by unit or tenant..." 
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unitNumber">Unit Number</SelectItem>
              <SelectItem value="status">Status</SelectItem>
              <SelectItem value="rentAmount">Rent Amount</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
          >
            {sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {filteredAndSortedUnits.map((unit: any) => {
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
