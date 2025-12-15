
'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Filters {
  term: string;
  date: string;
  category: string;
}

interface TransactionToolbarProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
}

export function TransactionToolbar({ filters, onFiltersChange }: TransactionToolbarProps) {

  const handleInputChange = (field: keyof Filters, value: string) => {
    onFiltersChange({ ...filters, [field]: value });
  };

  const clearAll = () => {
    onFiltersChange({ term: '', date: '', category: 'all' });
  };

  const hasFilters = filters.term || filters.date || (filters.category && filters.category !== 'all');

  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-4">
      
      <div className="flex flex-1 items-center space-x-2 w-full">
        <Input
          placeholder="Search descriptions..."
          value={filters.term}
          onChange={(e) => handleInputChange('term', e.target.value)}
          className="h-9 w-full md:w-[250px]"
        />
        
        <Input
            type="date"
            value={filters.date}
            onChange={(e) => handleInputChange('date', e.target.value)}
            className="h-9 w-[200px]"
            placeholder="Filter by date"
        />

        <Select onValueChange={(value) => handleInputChange('category', value)} value={filters.category}>
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
          <Button variant="ghost" size="sm" onClick={clearAll} className="h-9 px-2 lg:px-3">
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
