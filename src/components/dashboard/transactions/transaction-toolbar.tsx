'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, Calendar as CalendarIcon, Flag } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';

interface TransactionToolbarProps {
  onSearch: (term: string) => void;
  onDateChange: (date: Date | undefined) => void;
  onCategoryFilter: (category: string) => void;
  onStatusFilterChange: (statuses: string[]) => void;
  onClear: () => void;
}

export function TransactionToolbar({ 
  onSearch, 
  onDateChange, 
  onCategoryFilter, 
  onStatusFilterChange,
  onClear 
}: TransactionToolbarProps) {
  const [date, setDate] = React.useState<Date>();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [category, setCategory] = React.useState('all');
  const [statusFilters, setStatusFilters] = React.useState<string[]>([]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    if (onSearch) onSearch(value);
  };

  const handleDateSelect = (d: Date | undefined) => {
    setDate(d);
    if (onDateChange) onDateChange(d);
  };

  const handleCategoryChange = (value: string) => {
    setCategory(value);
    if (onCategoryFilter) onCategoryFilter(value);
  };

  const handleStatusChange = (status: string) => {
    const newStatusFilters = statusFilters.includes(status)
      ? statusFilters.filter(s => s !== status)
      : [...statusFilters, status];
    setStatusFilters(newStatusFilters);
    onStatusFilterChange(newStatusFilters);
  };

  const clearAll = () => {
    setSearchTerm('');
    setDate(undefined);
    setCategory('all');
    setStatusFilters([]);
    if (onClear) onClear();
  };

  const hasFilters = searchTerm || date || category !== 'all' || statusFilters.length > 0;

  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-4">
      
      {/* Search & Filters */}
      <div className="flex flex-1 items-center space-x-2 w-full">
        <Input
          placeholder="Search descriptions, merchants..."
          value={searchTerm}
          onChange={handleSearch}
          className="h-9 w-full md:w-[300px]"
        />
        
        {/* Date Filter */}
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

        {/* Category Filter */}
        <Select onValueChange={handleCategoryChange} value={category}>
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

        {/* Status Filter */}
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9">
                    <Flag className="mr-2 h-4 w-4" />
                    Status {statusFilters.length > 0 && `(${statusFilters.length})`}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                    checked={statusFilters.includes('approved')}
                    onCheckedChange={() => handleStatusChange('approved')}
                >
                    <Flag className="mr-2 h-4 w-4 text-green-500" />
                    Approved
                </DropdownMenuCheckboxItem>
                 <DropdownMenuCheckboxItem
                    checked={statusFilters.includes('needs-review')}
                    onCheckedChange={() => handleStatusChange('needs-review')}
                >
                    <Flag className="mr-2 h-4 w-4 text-yellow-500" />
                    Needs Review
                </DropdownMenuCheckboxItem>
                 <DropdownMenuCheckboxItem
                    checked={statusFilters.includes('incorrect')}
                    onCheckedChange={() => handleStatusChange('incorrect')}
                >
                    <Flag className="mr-2 h-4 w-4 text-red-500" />
                    Incorrect
                </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
        </DropdownMenu>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="h-9 px-2 lg:px-3">
            Reset
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
