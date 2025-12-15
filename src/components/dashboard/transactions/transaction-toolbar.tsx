
'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, Calendar as CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface TransactionToolbarProps {
  onSearch: (term: string) => void;
  onDateChange: (date: Date | undefined) => void;
  onCategoryFilter: (category: string) => void;
  onClear: () => void;
}

export function TransactionToolbar({ onSearch, onDateChange, onCategoryFilter, onClear }: TransactionToolbarProps) {
  const [date, setDate] = useState<Date>();
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState('all');

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    onSearch(e.target.value);
  };

  const handleDateSelect = (d: Date | undefined) => {
    setDate(d);
    onDateChange(d);
  };
  
  const handleCategorySelect = (c: string) => {
    setCategory(c);
    onCategoryFilter(c);
  };

  const clearAll = () => {
    setSearchTerm('');
    setDate(undefined);
    setCategory('all');
    onClear();
  };

  const hasFilters = searchTerm || date || (category && category !== 'all');

  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-4">
      
      <div className="flex flex-1 items-center space-x-2 w-full">
        <Input
          placeholder="Search descriptions, merchants..."
          value={searchTerm}
          onChange={handleSearch}
          className="h-9 w-full md:w-[300px]"
        />
        
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn("h-9 justify-start text-left font-normal", !date && "text-muted-foreground")}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? format(date, "MMM dd, yyyy") : "Date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              onSelect={handleDateSelect}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        <Select onValueChange={handleCategorySelect} value={category}>
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

    