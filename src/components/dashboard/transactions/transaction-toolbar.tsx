
'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { type DateRange } from 'react-day-picker';
import { format, parse } from 'date-fns';

export interface TransactionFilters {
  searchTerm: string;
  dateRange?: DateRange;
  category: string;
}

interface TransactionToolbarProps {
  filters: TransactionFilters;
  onFiltersChange: (filters: Partial<TransactionFilters>) => void;
  onClear: () => void;
}

export function TransactionToolbar({ filters, onFiltersChange, onClear }: TransactionToolbarProps) {
  const hasFilters = filters.searchTerm || filters.dateRange || (filters.category && filters.category !== 'all');
  
  const handleDateChange = (field: 'from' | 'to', value: string) => {
    const newDate = value ? parse(value, 'yyyy-MM-dd', new Date()) : undefined;
    
    // Create a valid date range, ensuring 'from' is not after 'to'
    let newRange = { ...filters.dateRange };
    if (field === 'from') {
        newRange.from = newDate;
        if (newRange.to && newDate && newDate > newRange.to) {
            newRange.to = newDate; // Adjust 'to' if 'from' is later
        }
    } else { // field === 'to'
        newRange.to = newDate;
         if (newRange.from && newDate && newDate < newRange.from) {
            newRange.from = newDate; // Adjust 'from' if 'to' is earlier
        }
    }

    onFiltersChange({ dateRange: newRange });
  };


  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-4">
      
      <div className="flex flex-1 items-center space-x-2 w-full">
        <Input
          placeholder="Search descriptions..."
          value={filters.searchTerm}
          onChange={(e) => onFiltersChange({ searchTerm: e.target.value })}
          className="h-9 w-full md:w-[250px]"
        />
        
        <Input
          type="date"
          value={filters.dateRange?.from ? format(filters.dateRange.from, 'yyyy-MM-dd') : ''}
          onChange={(e) => handleDateChange('from', e.target.value)}
          className="h-9 w-full md:w-[150px] text-muted-foreground"
          aria-label="Start date"
        />
        <Input
          type="date"
          value={filters.dateRange?.to ? format(filters.dateRange.to, 'yyyy-MM-dd') : ''}
          onChange={(e) => handleDateChange('to', e.target.value)}
          className="h-9 w-full md:w-[150px] text-muted-foreground"
          aria-label="End date"
        />


        <Select onValueChange={(value) => onFiltersChange({ category: value })} value={filters.category}>
             <SelectTrigger className="h-9 w-[150px]">
                 <SelectValue placeholder="Category" />
             </SelectTrigger>
             <SelectContent>
                 <SelectItem value="all">All Categories</SelectItem>
                 <SelectItem value="Income">Income</SelectItem>
                 <SelectItem value="Operating Expenses">Expenses</SelectItem>
                 <SelectItem value="Cost of Goods Sold">COGS</SelectItem>
             </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={onClear} className="h-9 px-2 lg:px-3">
            Reset
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
      
      <div className="flex items-center space-x-2">
      </div>
    </div>
  );
}
