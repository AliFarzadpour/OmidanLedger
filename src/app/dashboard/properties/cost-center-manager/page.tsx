'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Edit, Search, ArrowUpDown, FolderTree } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BatchEditDialog } from '@/components/dashboard/transactions/batch-edit-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import type { Transaction } from '@/components/dashboard/transactions-table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Tx = Transaction & { id: string };
type SortKey = 'date' | 'description' | 'category' | 'costCenter' | 'amount';
type SortDirection = 'asc' | 'desc';

const primaryCategoryColors: Record<string, string> = {
  'income': 'bg-green-100 text-green-800',
  'expense': 'bg-blue-100 text-blue-800',
  'equity': 'bg-indigo-100 text-indigo-800',
  'liability': 'bg-orange-100 text-orange-800',
  'asset': 'bg-gray-200 text-gray-800',
};

export default function CostCenterManagerPage() {
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();

  // --- FILTER & SORT STATE ---
  const [searchTerm, setSearchTerm] = useState('');
  const [assignmentFilter, setAssignmentFilter] = useState<'unassigned' | 'assigned' | 'all'>('unassigned');
  const [l0Filter, setL0Filter] = useState('all');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'date', direction: 'desc' });
  
  // --- DATA & SELECTION STATE ---
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBatchEditDialogOpen, setIsBatchEditDialogOpen] = useState(false);
  const [allTransactions, setAllTransactions] = useState<Tx[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);

  // --- DATA FETCHING ---
  const refetchTransactions = useCallback(async () => {
    if (!user || !firestore) return;

    setIsLoadingTransactions(true);
    try {
      const bankSnap = await getDocs(collection(firestore, "users", user.uid, "bankAccounts"));
      const txs: Tx[] = [];
      for (const bankDoc of bankSnap.docs) {
        const txSnap = await getDocs(collection(firestore, "users", user.uid, "bankAccounts", bankDoc.id, "transactions"));
        txSnap.forEach((d) => {
          txs.push({ id: d.id, ...(d.data() as any) });
        });
      }
      txs.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      setAllTransactions(txs);
    } finally {
      setIsLoadingTransactions(false);
    }
  }, [user, firestore]);

  useEffect(() => {
    refetchTransactions();
  }, [refetchTransactions]);
  
  const propertiesQuery = useMemo(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'properties'), where('userId', '==', user.uid));
  }, [user, firestore]);

  const { data: properties, isLoading: isLoadingProperties } = useCollection(propertiesQuery);
  
  const propertyMap = useMemo(() => {
    if (!properties) return {};
    return properties.reduce((acc, prop: any) => {
        acc[prop.id] = prop.name;
        return acc;
    }, {} as Record<string, string>);
  }, [properties]);

  const filteredAndSortedTransactions = useMemo(() => {
    let filtered = allTransactions;

    // Filter by assignment status
    if (assignmentFilter === 'unassigned') {
        filtered = filtered.filter(tx => !tx.costCenter);
    } else if (assignmentFilter === 'assigned') {
        filtered = filtered.filter(tx => !!tx.costCenter);
    }

    // Filter by L0 Category
    if (l0Filter !== 'all') {
        filtered = filtered.filter(tx => {
            const l0 = (tx.categoryHierarchy?.l0 || 'Uncategorized').toLowerCase();
            const filter = l0Filter.toLowerCase();
            const normalized = l0.includes('income') ? 'income' : l0.includes('expense') ? 'expense' : l0.includes('asset') ? 'asset' : l0.includes('liabil') ? 'liability' : l0.includes('equity') ? 'equity' : 'other';
            return normalized === filter;
        });
    }
    
    // Filter by search term
    if (searchTerm) {
        filtered = filtered.filter(tx => tx.description.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    // Sort
    filtered.sort((a, b) => {
        const aVal = (a as any)[sortConfig.key] || '';
        const bVal = (b as any)[sortConfig.key] || '';
        
        if (sortConfig.key === 'date') {
             return sortConfig.direction === 'asc' 
                ? new Date(aVal).getTime() - new Date(bVal).getTime() 
                : new Date(bVal).getTime() - new Date(aVal).getTime();
        }

        if (sortConfig.direction === 'asc') {
            return String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
        } else {
            return String(bVal).localeCompare(String(aVal), undefined, { numeric: true });
        }
    });

    return filtered;
  }, [allTransactions, assignmentFilter, l0Filter, searchTerm, sortConfig]);
  
  const selectedTransactions = useMemo(() => {
    return filteredAndSortedTransactions.filter(tx => selectedIds.includes(tx.id));
  }, [filteredAndSortedTransactions, selectedIds]);
  
  const handleSelectionChange = (id: string, checked: boolean) => {
    setSelectedIds(prev => 
        checked ? [...prev, id] : prev.filter(i => i !== id)
    );
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
        setSelectedIds(filteredAndSortedTransactions.map(t => t.id));
    } else {
        setSelectedIds([]);
    }
  };
  
  const requestSort = (key: SortKey) => {
    setSortConfig(prev => ({
        key,
        direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const getSortIcon = (key: SortKey) => (
    sortConfig.key === key ? <ArrowUpDown className="h-4 w-4 inline" /> : <ArrowUpDown className="h-4 w-4 inline opacity-30" />
  );

  const isLoading = isLoadingTransactions || isLoadingProperties;

  return (
    <>
    <div className="space-y-6 p-8">
      <header className="flex justify-between items-start">
        <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
                <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              {isLoading ? (
                  <>
                    <Skeleton className="h-8 w-64 mb-2"/>
                    <Skeleton className="h-4 w-80"/>
                  </>
              ) : (
                <>
                  <h1 className="text-3xl font-bold flex items-center gap-2">
                    <FolderTree className="h-8 w-8 text-primary"/>
                    Cost Center Manager
                  </h1>
                  <p className="text-muted-foreground">Assign transactions to the correct property or unit.</p>
                </>
              )}
            </div>
        </div>
      </header>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 p-4 bg-slate-50 border rounded-lg">
        <div className="relative flex-grow">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
                placeholder="Filter by description..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
        <Select value={assignmentFilter} onValueChange={(val: any) => setAssignmentFilter(val)}>
            <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by status..." />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="all">All</SelectItem>
            </SelectContent>
        </Select>
        {/* L0 Category Filter */}
        <Select value={l0Filter} onValueChange={setL0Filter}>
            <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by category..." />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="asset">Asset</SelectItem>
                <SelectItem value="liability">Liability</SelectItem>
                <SelectItem value="equity">Equity</SelectItem>
            </SelectContent>
        </Select>
      </div>
      
      {selectedIds.length > 0 && (
            <div className="flex items-center gap-4 p-3 bg-blue-50 border border-blue-200 rounded-lg animate-in fade-in-50">
                <div className="flex-grow">
                    <span className="font-semibold text-blue-800">{selectedIds.length}</span> items selected.
                </div>
                 <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsBatchEditDialogOpen(true)}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Assign to Cost Center...
                </Button>
            </div>
        )}

      {/* Table */}
       <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px] p-2">
                    <Checkbox
                        checked={filteredAndSortedTransactions.length > 0 && selectedIds.length === filteredAndSortedTransactions.length}
                        onCheckedChange={(checked) => handleSelectAll(!!checked)}
                    />
                </TableHead>
                <TableHead><Button variant="ghost" onClick={() => requestSort('date')}>Date {getSortIcon('date')}</Button></TableHead>
                <TableHead><Button variant="ghost" onClick={() => requestSort('description')}>Description {getSortIcon('description')}</Button></TableHead>
                <TableHead><Button variant="ghost" onClick={() => requestSort('category')}>Category {getSortIcon('category')}</Button></TableHead>
                <TableHead><Button variant="ghost" onClick={() => requestSort('costCenter')}>Cost Center {getSortIcon('costCenter')}</Button></TableHead>
                <TableHead className="text-right"><Button variant="ghost" onClick={() => requestSort('amount')}>Amount {getSortIcon('amount')}</Button></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(10)].map((_, i) => <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell></TableRow>)
              ) : filteredAndSortedTransactions.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center h-32">No matching transactions found.</TableCell></TableRow>
              ) : (
                filteredAndSortedTransactions.map(tx => {
                    const l0 = (tx.categoryHierarchy?.l0 || 'Uncategorized').toLowerCase();
                    const normalizedL0 = l0.includes('income') ? 'income' : l0.includes('expense') ? 'expense' : l0.includes('asset') ? 'asset' : l0.includes('liabil') ? 'liability' : l0.includes('equity') ? 'equity' : 'other';
                    return (
                      <TableRow key={tx.id}>
                        <TableCell className="p-2">
                             <Checkbox 
                                checked={selectedIds.includes(tx.id)}
                                onCheckedChange={(checked) => handleSelectionChange(tx.id, !!checked)}
                            />
                        </TableCell>
                        <TableCell>{tx.date}</TableCell>
                        <TableCell className="font-medium max-w-[300px] truncate">{tx.description}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn('w-fit border-0 font-semibold px-2 py-1', primaryCategoryColors[normalizedL0] || 'bg-slate-100')}>
                            {tx.categoryHierarchy?.l0 || 'N/A'}
                          </Badge>
                          <p className="text-xs text-muted-foreground">{tx.categoryHierarchy?.l1} &gt; {tx.categoryHierarchy?.l2}</p>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{tx.costCenter ? (propertyMap[tx.costCenter] || tx.costCenter) : <Badge variant="outline">Unassigned</Badge>}</TableCell>
                        <TableCell className={cn("text-right font-mono", tx.amount > 0 ? "text-green-600 font-semibold" : "text-slate-700")}>
                          {tx.amount > 0 && '+'}{tx.amount.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
       </Card>
    </div>
    {isBatchEditDialogOpen && (
        <BatchEditDialog
          isOpen={isBatchEditDialogOpen}
          onOpenChange={setIsBatchEditDialogOpen}
          transactions={selectedTransactions}
          onSuccess={() => {
            setSelectedIds([]);
            refetchTransactions();
          }}
        />
    )}
    </>
  );
}
