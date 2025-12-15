
'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, Calendar as CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';

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

  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-4">
      
      <div className="flex flex-1 items-center space-x-2 w-full">
        <Input
          placeholder="Search descriptions, merchants..."
          value={filters.searchTerm}
          onChange={(e) => onFiltersChange({ searchTerm: e.target.value })}
          className="h-9 w-full md:w-[300px]"
        />
        
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn("h-9 w-[240px] justify-start text-left font-normal", !filters.dateRange && "text-muted-foreground")}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filters.dateRange?.from ? (
                filters.dateRange.to ? (
                  <>
                    {format(filters.dateRange.from, "LLL dd, y")} - {format(filters.dateRange.to, "LLL dd, y")}
                  </>
                ) : (
                  format(filters.dateRange.from, "LLL dd, y")
                )
              ) : (
                "Date"
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={filters.dateRange?.from}
              selected={filters.dateRange}
              onSelect={(range) => onFiltersChange({ dateRange: range })}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>

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
