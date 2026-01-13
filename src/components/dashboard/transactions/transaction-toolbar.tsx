
'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, Calendar as CalendarIcon, Flag, BookUser, Combine } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { MergeCategoriesDialog } from './MergeCategoriesDialog';
import { Label } from '@/components/ui/label';

interface TransactionToolbarProps {
  onSearch: (term: string) => void;
  onDateRangeChange: (range: { from: string; to: string }) => void; // Updated
  onCategoryFilter: (category: string) => void;
  onStatusFilterChange: (statuses: string[]) => void;
  onClear: () => void;
  onRefresh: () => void;
}

export function TransactionToolbar({ 
  onSearch, 
  onDateRangeChange, // Updated
  onCategoryFilter, 
  onStatusFilterChange,
  onClear,
  onRefresh
}: TransactionToolbarProps) {
  const [dates, setDates] = React.useState({ from: '', to: '' }); // Updated state
  const [searchTerm, setSearchTerm] = React.useState('');
  const [category, setCategory] = React.useState('all');
  const [statusFilters, setStatusFilters] = React.useState<string[]>([]);
  const [isMergeToolOpen, setIsMergeToolOpen] = React.useState(false);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    if (onSearch) onSearch(value);
  };

  const handleDateChange = (field: 'from' | 'to', value: string) => {
    const newDates = { ...dates, [field]: value };
    setDates(newDates);
    if (newDates.from && newDates.to) {
      onDateRangeChange(newDates);
    }
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
    setDates({ from: '', to: '' });
    setCategory('all');
    setStatusFilters([]);
    if (onClear) onClear();
  };

  const hasFilters = searchTerm || dates.from || dates.to || category !== 'all' || statusFilters.length > 0;

  return (
    <>
    <div className="flex flex-col md:flex-row items-end justify-between gap-4 py-4">
      
      {/* Search & Filters */}
      <div className="flex flex-1 flex-wrap items-end space-x-2 w-full">
        <div className="flex-grow min-w-[200px]">
          <Label>Search</Label>
          <Input
            placeholder="Descriptions, merchants..."
            value={searchTerm}
            onChange={handleSearch}
            className="h-9"
          />
        </div>
        
        {/* Date Range Filter */}
        <div className="flex-grow">
          <Label>From</Label>
          <Input 
            type="date" 
            value={dates.from} 
            onChange={e => handleDateChange('from', e.target.value)} 
            className="h-9"
          />
        </div>
         <div className="flex-grow">
          <Label>To</Label>
          <Input 
            type="date" 
            value={dates.to} 
            onChange={e => handleDateChange('to', e.target.value)} 
            className="h-9"
          />
        </div>

        {/* Category Filter */}
        <div className="flex-grow">
          <Label>Category</Label>
          <Select onValueChange={handleCategoryChange} value={category}>
               <SelectTrigger className="h-9 w-full">
                   <SelectValue placeholder="Category" />
               </SelectTrigger>
               <SelectContent>
                   <SelectItem value="all">All Categories</SelectItem>
                   <SelectItem value="Income">Income</SelectItem>
                   <SelectItem value="Expense">Expense</SelectItem>
                   <SelectItem value="Equity">Equity</SelectItem>
                   <SelectItem value="Liability">Liability</SelectItem>
                   <SelectItem value="Asset">Asset</SelectItem>
               </SelectContent>
          </Select>
        </div>

        {/* Status Filter */}
        <div className="flex-grow">
          <Label>Status</Label>
          <DropdownMenu>
              <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 w-full justify-start">
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
        </div>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="h-9 px-2 lg:px-3">
            Reset
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>

       <div className="flex items-center gap-2">
           <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => setIsMergeToolOpen(true)}
        >
            <Combine className="mr-2 h-4 w-4" />
            Merge Categories
        </Button>
       </div>
    </div>
    {isMergeToolOpen && <MergeCategoriesDialog isOpen={isMergeToolOpen} onOpenChange={setIsMergeToolOpen} onSuccess={onRefresh} />}
    </>
  );
}
