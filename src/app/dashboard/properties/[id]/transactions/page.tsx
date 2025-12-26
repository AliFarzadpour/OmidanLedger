
'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, collectionGroup, query, where, doc, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, BookOpen, Edit, Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BatchEditDialog } from '@/components/dashboard/transactions/batch-edit-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import type { Transaction } from '@/components/dashboard/transactions-table';

export default function PropertyLedgerPage() {
  const { id: propertyId } = useParams();
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();

  const [searchTerm, setSearchTerm] = useState('');
  const [l0Filter, setL0Filter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBatchEditDialogOpen, setBatchEditDialogOpen] = useState(false);

  // --- DATA FETCHING ---
  const propertyDocRef = useMemoFirebase(() => {
    if (!firestore || !propertyId) return null;
    return doc(firestore, 'properties', propertyId as string);
  }, [firestore, propertyId]);

  const { data: propertyData, isLoading: isLoadingProperty } = useDoc(propertyDocRef);

  const transactionsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collectionGroup(firestore, 'transactions'), where('userId', '==', user.uid));
  }, [user, firestore]);

  const { data: allTransactions, isLoading: isLoadingTransactions, refetch } = useCollection<Transaction>(transactionsQuery);

  // --- FILTERING LOGIC ---
  const filteredTransactions = useMemo(() => {
    if (!allTransactions) return [];
    return allTransactions.filter(tx => {
      // Show transactions already assigned to this property OR unassigned ones
      const isRelevant = !tx.costCenter || tx.costCenter === propertyId;
      if (!isRelevant) return false;

      // Filter by L0 category
      if (l0Filter !== 'all' && tx.categoryHierarchy?.l0 !== l0Filter) {
        return false;
      }
      // Filter by search term
      if (searchTerm && !tx.description.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [allTransactions, propertyId, l0Filter, searchTerm]);
  
  const selectedTransactions = useMemo(() => {
    return filteredTransactions.filter(tx => selectedIds.includes(tx.id));
  }, [filteredTransactions, selectedIds]);
  
  const handleSelectionChange = (id: string, checked: boolean) => {
    setSelectedIds(prev => 
        checked ? [...prev, id] : prev.filter(i => i !== id)
    );
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
        setSelectedIds(filteredTransactions.map(t => t.id));
    } else {
        setSelectedIds([]);
    }
  };


  const isLoading = isLoadingProperty || isLoadingTransactions;

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
                    <Skeleton className="h-4 w-48"/>
                  </>
              ) : (
                <>
                  <h1 className="text-3xl font-bold">Property Ledger</h1>
                  <p className="text-muted-foreground">Managing transactions for {propertyData?.name}</p>
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
        <Select value={l0Filter} onValueChange={setL0Filter}>
            <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by category..." />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">All L0 Categories</SelectItem>
                <SelectItem value="Income">Income</SelectItem>
                <SelectItem value="Expense">Expense</SelectItem>
                <SelectItem value="Asset">Asset</SelectItem>
                <SelectItem value="Liability">Liability</SelectItem>
                <SelectItem value="Equity">Equity</SelectItem>
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
                    onClick={() => setBatchEditDialogOpen(true)}
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
                        checked={filteredTransactions.length > 0 && selectedIds.length === filteredTransactions.length}
                        onCheckedChange={(checked) => handleSelectAll(!!checked)}
                    />
                </TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Cost Center</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell></TableRow>)
              ) : filteredTransactions.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center h-32">No matching transactions found.</TableCell></TableRow>
              ) : (
                filteredTransactions.map(tx => (
                  <TableRow key={tx.id}>
                    <TableCell className="p-2">
                         <Checkbox 
                            checked={selectedIds.includes(tx.id)}
                            onCheckedChange={(checked) => handleSelectionChange(tx.id, !!checked)}
                        />
                    </TableCell>
                    <TableCell>{tx.date}</TableCell>
                    <TableCell className="font-medium max-w-[300px] truncate">{tx.description}</TableCell>
                    <TableCell>{tx.categoryHierarchy?.l2 || tx.categoryHierarchy?.l1}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{tx.costCenter ? propertyData?.name : 'Unassigned'}</TableCell>
                    <TableCell className="text-right font-mono">{tx.amount.toFixed(2)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
       </Card>
    </div>
    {isBatchEditDialogOpen && (
        <BatchEditDialog
          isOpen={isBatchEditDialogOpen}
          onOpenChange={setBatchEditDialogOpen}
          transactions={selectedTransactions}
          onSuccess={() => {
            setSelectedIds([]);
            refetch();
          }}
        />
    )}
    </>
  );
}
