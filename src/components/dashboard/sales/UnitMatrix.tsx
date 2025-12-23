

'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bed, Bath, Square, Users, DollarSign, Search, ArrowUp, ArrowDown, Bot, Edit, Palette } from 'lucide-react';
import { UnitDetailDrawer } from '@/components/dashboard/sales/UnitDetailDrawer';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { BulkActionsDialog } from './BulkActionsDialog';
import { cn } from '@/lib/utils';


type SortKey = 'unitNumber' | 'status' | 'rentAmount';
type SortDirection = 'asc' | 'desc';

const COLOR_PALETTE = [
    { name: 'Red', value: '#ef4444' },
    { name: 'Orange', value: '#f97316' },
    { name: 'Amber', value: '#f59e0b' },
    { name: 'Green', value: '#22c55e' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Indigo', value: '#6366f1' },
    { name: 'Purple', value: '#8b5cf6' },
    { name: 'Pink', value: '#ec4899' },
];


export function UnitMatrix({ propertyId, units, onUpdate }: { propertyId: string, units: any[], onUpdate: () => void }) {
  const [selectedUnit, setSelectedUnit] = useState<any>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  // State for filtering and sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [colorFilter, setColorFilter] = useState('all');
  const [sortBy, setSortBy] = useState<SortKey>('unitNumber');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // New state for selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkActionsOpen, setIsBulkActionsOpen] = useState(false);


  const handleUnitClick = (unit: any) => {
    setSelectedUnit(unit);
    setIsDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setIsDrawerOpen(false);
    setSelectedUnit(null);
  };

  const handleCheckboxChange = (unitId: string, checked: boolean) => {
    const newSelectedIds = new Set(selectedIds);
    if (checked) {
      newSelectedIds.add(unitId);
    } else {
      newSelectedIds.delete(unitId);
    }
    setSelectedIds(newSelectedIds);
  };


  const filteredAndSortedUnits = useMemo(() => {
    if (!units) return [];

    let filtered = [...units];

    // Filter by color
    if (colorFilter !== 'all') {
      filtered = filtered.filter(unit => unit.tagColor === colorFilter);
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(unit => {
        const tenantName = unit.tenants?.find((t: any) => t.status === 'active')?.firstName ? `${unit.tenants.find((t: any) => t.status === 'active').firstName} ${unit.tenants.find((t: any) => t.status === 'active').lastName}` : '';
        return (
          unit.unitNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
          tenantName.toLowerCase().includes(searchTerm.toLowerCase())
        );
      });
    }

    // Sort the filtered units
    filtered.sort((a, b) => {
      let valA, valB;
      const rentA = a.tenants?.find((t: any) => t.status === 'active')?.rentAmount || a.financials?.rent || 0;
      const rentB = b.tenants?.find((t: any) => t.status === 'active')?.rentAmount || b.financials?.rent || 0;

      switch (sortBy) {
        case 'status':
          valA = a.tenants?.some((t: any) => t.status === 'active') ? 1 : 0; // Occupied = 1, Vacant = 0
          valB = b.tenants?.some((t: any) => t.status === 'active') ? 1 : 0;
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
  }, [units, searchTerm, colorFilter, sortBy, sortDirection]);
  
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allFilteredIds = new Set(filteredAndSortedUnits.map(u => u.id));
      setSelectedIds(allFilteredIds);
    } else {
      setSelectedIds(new Set());
    }
  };

  const isAllFilteredSelected = filteredAndSortedUnits.length > 0 && selectedIds.size === filteredAndSortedUnits.length;


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
           <Select value={colorFilter} onValueChange={setColorFilter}>
            <SelectTrigger className="w-[180px]">
                <div className="flex items-center gap-2">
                    <Palette className="h-4 w-4" />
                    <SelectValue placeholder="Filter by color..." />
                </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Colors</SelectItem>
              {COLOR_PALETTE.map(color => (
                <SelectItem key={color.value} value={color.value}>
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded-full" style={{ backgroundColor: color.value }} />
                    {color.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

        {selectedIds.size > 0 && (
            <div className="flex items-center gap-4 mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg animate-in fade-in-50">
                <div className="flex-grow">
                    <span className="font-semibold text-blue-800">{selectedIds.size}</span> units selected.
                </div>
                <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>Clear Selection</Button>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => setIsBulkActionsOpen(true)}>
                    <Edit className="mr-2 h-4 w-4" /> Bulk Actions
                </Button>
            </div>
        )}

        <div className="flex items-center gap-3 mb-4">
             <Checkbox 
                id="select-all" 
                checked={isAllFilteredSelected} 
                onCheckedChange={handleSelectAll} 
             />
             <label htmlFor="select-all" className="text-sm font-medium">Select all {filteredAndSortedUnits.length} filtered units</label>
        </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {filteredAndSortedUnits.map((unit: any) => {
          const isOccupied = unit.tenants?.some((t: any) => t.status === 'active');
          const activeTenant = isOccupied ? unit.tenants.find((t: any) => t.status === 'active') : null;
          const tenantName = activeTenant ? `${activeTenant.firstName} ${activeTenant.lastName}`.trim() : 'No Tenant';
          const rentAmount = activeTenant ? activeTenant.rentAmount : (unit.financials?.rent || 0);
          const borderColor = unit.tagColor || 'hsl(var(--border))';

          return (
             <div key={unit.id} className="relative">
                <div 
                    onClick={() => handleUnitClick(unit)}
                    className="h-full"
                >
                    <Card 
                        className="hover:shadow-md transition-all border-l-4 hover:border-primary h-full flex flex-col justify-between"
                        style={{ borderLeftColor: borderColor }}
                    >
                        <CardHeader className="pb-2 flex flex-row items-start justify-between">
                            <Badge variant={isOccupied ? 'default' : 'destructive'}>
                            {isOccupied ? 'Occupied' : 'Vacant'}
                            </Badge>
                            <span className="text-sm font-mono font-bold text-slate-500">#{unit.unitNumber}</span>
                        </CardHeader>
                        
                        <CardContent className="space-y-3">
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
                </div>
                 <div
                    className="absolute top-2 left-2 z-10"
                    onClick={(e) => e.stopPropagation()} // Prevents drawer from opening
                >
                    <Checkbox
                        checked={selectedIds.has(unit.id)}
                        onCheckedChange={(checked) => handleCheckboxChange(unit.id, !!checked)}
                        className="bg-white"
                    />
                </div>
            </div>
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
      {selectedIds.size > 0 && (
          <BulkActionsDialog
            isOpen={isBulkActionsOpen}
            onOpenChange={setIsBulkActionsOpen}
            propertyId={propertyId}
            selectedUnitIds={Array.from(selectedIds)}
            onSuccess={() => {
                onUpdate();
                setSelectedIds(new Set());
            }}
          />
      )}
    </>
  );
}

    