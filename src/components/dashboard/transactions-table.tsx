

'use client';

import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
import { Upload, ArrowUpDown, Trash2, Pencil, RefreshCw, Edit, Flag, Check, XIcon, AlertTriangle as AlertTriangleIcon } from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, writeBatch, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { UploadTransactionsDialog } from './transactions/upload-transactions-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { learnCategoryMapping } from '@/ai/flows/learn-category-mapping';
import { syncAndCategorizePlaidTransactions } from '@/lib/plaid';
import { TransactionToolbar } from './transactions/transaction-toolbar';
import { Checkbox } from '@/components/ui/checkbox';
import { BatchEditDialog } from './transactions/batch-edit-dialog';

const primaryCategoryColors: Record<string, string> = {
  'Income': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  'Cost of Goods Sold': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  'Expenses': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  'Balance Sheet': 'bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
};

interface DataSource {
  id: string;
  accountName: string;
  bankName: string;
  plaidAccessToken?: string;
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  categoryHierarchy: {
    l0: string;
    l1: string;
    l2: string;
    l3: string;
  };
  primaryCategory: string; // Legacy
  secondaryCategory: string; // Legacy
  subcategory: string; // Legacy
  details?: string; // Legacy
  confidence?: number;
  accountId?: string;
  accountName?: string; 
  status?: 'posted' | 'review' | 'error' | 'ready';
  reviewStatus?: 'needs-review' | 'approved' | 'incorrect';
  bankAccountId?: string;
}

type SortKey = 'date' | 'description' | 'category' | 'amount' | 'reviewStatus';
type SortDirection = 'ascending' | 'descending';

interface TransactionsTableProps {
  dataSource: DataSource;
}


export function TransactionsTable({ dataSource }: TransactionsTableProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [isUploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [isBatchEditDialogOpen, setBatchEditDialogOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isClearAlertOpen, setClearAlertOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'date', direction: 'descending' });
  const [filterTerm, setFilterTerm] = useState('');
  const [filterDate, setFilterDate] = useState<Date | undefined>();
  const [filterCategory, setFilterCategory] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);

  const transactionsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !dataSource) return null;
    return collection(firestore, `users/${user.uid}/bankAccounts/${dataSource.id}/transactions`);
  }, [firestore, user, dataSource]);

  const { data: transactions, isLoading } = useCollection<Transaction>(transactionsQuery);

  const handleClearTransactions = async () => {
    if (!firestore || !user || !dataSource || !transactionsQuery) return;
    setIsClearing(true);
    setClearAlertOpen(false);
    
    try {
        const querySnapshot = await getDocs(transactionsQuery);
        const batch = writeBatch(firestore);
        querySnapshot.forEach((doc) => batch.delete(doc.ref));
        
        const bankAccountRef = doc(firestore, `users/${user.uid}/bankAccounts/${dataSource.id}`);
        batch.update(bankAccountRef, { plaidSyncCursor: null });

        await batch.commit();
        
        toast({ title: "Transactions Cleared", description: "History reset. You can now re-sync from scratch." });
    } catch (error: any) {
         console.error("Error clearing transactions:", error);
        toast({ variant: "destructive", title: "Error", description: `Could not clear transactions. ${error.message}` });
    } 
    finally { setIsClearing(false); }
  };

  const handleSyncTransactions = async () => {
    if (!user || !dataSource.plaidAccessToken) return;
    setIsSyncing(true);
    toast({ title: 'Syncing...', description: 'Fetching data from bank...' });
    try {
        const result = await syncAndCategorizePlaidTransactions({ userId: user.uid, bankAccountId: dataSource.id });
        toast({ title: 'Sync Complete', description: `${result.count} new transactions imported.` });
    } catch (error: any) {
        toast({ variant: "destructive", title: "Sync Failed", description: error.message });
    } finally { setIsSyncing(false); }
  };

  const handleCategoryChange = async (transaction: Transaction, newCategories: { primaryCategory: string; secondaryCategory: string; subcategory: string; details: string; }) => {
    if (!user || !firestore) return;
    const transactionRef = doc(firestore, `users/${user.uid}/bankAccounts/${dataSource.id}/transactions`, transaction.id);
    
    await updateDoc(transactionRef, { 
        categoryHierarchy: {
            l0: newCategories.primaryCategory,
            l1: newCategories.secondaryCategory,
            l2: newCategories.subcategory,
            l3: newCategories.details,
        },
        confidence: 1.0, 
        status: 'posted',
        reviewStatus: 'approved'
    });

    await learnCategoryMapping({
        transactionDescription: transaction.description,
        primaryCategory: newCategories.primaryCategory,
        secondaryCategory: newCategories.secondaryCategory,
        subcategory: newCategories.subcategory,
        details: newCategories.details,
        userId: user.uid,
    });
    toast({ title: "Updated", description: "Category saved and rule learned." });
  };
  
  const handleSelectionChange = (id: string, checked: boolean) => {
    setSelectedIds(prev => 
        checked ? [...prev, id] : prev.filter(i => i !== id)
    );
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
        setSelectedIds(sortedTransactions.map(t => t.id));
    } else {
        setSelectedIds([]);
    }
  };

  const handleBatchStatusUpdate = async (newStatus: 'approved' | 'needs-review' | 'incorrect') => {
    if (!user || !firestore || selectedIds.length === 0) return;
    
    const batch = writeBatch(firestore);
    selectedIds.forEach(id => {
      const docRef = doc(firestore, `users/${user.uid}/bankAccounts/${dataSource.id}/transactions`, id);
      batch.update(docRef, { reviewStatus: newStatus });
    });

    try {
      await batch.commit();
      toast({
        title: "Batch Update Successful",
        description: `${selectedIds.length} transactions have been marked as ${newStatus.replace('-', ' ')}.`,
      });
      setSelectedIds([]); // Clear selection after update
    } catch (error: any) {
      console.error(error);
      toast({ variant: "destructive", title: "Batch Update Failed", description: error.message });
    }
  };

  const sortedTransactions = useMemo(() => {
    if (!transactions) return [];
    let filtered = transactions.filter(t => {
       const matchesSearch = t.description.toLowerCase().includes(filterTerm.toLowerCase()) || t.amount.toString().includes(filterTerm);
       const matchesCategory = filterCategory && filterCategory !== 'all' ? (t.categoryHierarchy?.l0 || t.primaryCategory) === filterCategory : true;
       const matchesDate = filterDate ? new Date(t.date).toDateString() === filterDate.toDateString() : true;
       const matchesStatus = statusFilter.length > 0 ? statusFilter.includes(t.reviewStatus || 'needs-review') : true;
       return matchesSearch && matchesCategory && matchesDate && matchesStatus;
    });

    const statusSortOrder: { [key: string]: number } = { 'incorrect': 1, 'needs-review': 2, 'approved': 3 };

    filtered.sort((a, b) => {
      if (sortConfig.key === 'reviewStatus') {
        const aStatus = a.reviewStatus || 'needs-review';
        const bStatus = b.reviewStatus || 'needs-review';
        const aOrder = statusSortOrder[aStatus];
        const bOrder = statusSortOrder[bStatus];
        return sortConfig.direction === 'ascending' ? aOrder - bOrder : bOrder - aOrder;
      }
      
      let aValue: any = a[sortConfig.key as keyof Transaction] || '';
      let bValue: any = b[sortConfig.key as keyof Transaction] || '';
      
      if (sortConfig.key === 'category') {
        const aCats = a.categoryHierarchy || {l0: a.primaryCategory, l1: a.secondaryCategory, l2: a.subcategory, l3: a.details};
        const bCats = b.categoryHierarchy || {l0: b.primaryCategory, l1: b.secondaryCategory, l2: b.subcategory, l3: b.details};
        aValue = `${aCats.l0}${aCats.l1}${aCats.l2}${aCats.l3}`;
        bValue = `${bCats.l0}${bCats.l1}${bCats.l2}${bCats.l3}`;
      } else if (sortConfig.key === 'date') {
        return sortConfig.direction === 'ascending' ? new Date(a.date).getTime() - new Date(b.date).getTime() : new Date(b.date).getTime() - new Date(a.date).getTime();
      }
      
      if (typeof aValue === 'string') return sortConfig.direction === 'ascending' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      return sortConfig.direction === 'ascending' ? aValue - bValue : bValue - aValue;
    });
    return filtered;
  }, [transactions, sortConfig, filterTerm, filterDate, filterCategory, statusFilter]);
  
  const selectedTransactions = useMemo(() => {
    return sortedTransactions.filter(tx => selectedIds.includes(tx.id));
  }, [sortedTransactions, selectedIds]);

  const requestSort = (key: SortKey) => {
    setSortConfig({ key, direction: sortConfig.key === key && sortConfig.direction === 'ascending' ? 'descending' : 'ascending' });
  };
  
  const getSortIcon = (key: SortKey) => sortConfig.key === key ? <ArrowUpDown className="ml-2 h-4 w-4" /> : <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />;
  const hasTransactions = transactions && transactions.length > 0;
  const isPlaidAccount = !!dataSource.plaidAccessToken;

  return (
    <>
      <Card className="h-full shadow-lg">
        <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <CardTitle>Transactions for {dataSource.accountName}</CardTitle>
            <CardDescription>Showing all transactions from {dataSource.bankName}.</CardDescription>
          </div>
          <div className="flex gap-2">
            {isPlaidAccount ? (
              <Button onClick={handleSyncTransactions} disabled={isSyncing}><RefreshCw className={cn("mr-2 h-4 w-4", isSyncing && "animate-spin")} /> Sync</Button>
            ) : (
              <Button onClick={() => setUploadDialogOpen(true)}><Upload className="mr-2 h-4 w-4" /> Upload Statement</Button>
            )}
            <Button variant="destructive" onClick={() => setClearAlertOpen(true)} disabled={!hasTransactions || isClearing}><Trash2 className="mr-2 h-4 w-4" /> Clear</Button>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="flex flex-col gap-4">
            <TransactionToolbar 
                onSearch={setFilterTerm}
                onDateChange={setFilterDate}
                onCategoryFilter={setFilterCategory}
                onStatusFilterChange={setStatusFilter}
                onClear={() => { setFilterTerm(''); setFilterDate(undefined); setFilterCategory(''); setStatusFilter([]); }}
            />
            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg animate-in fade-in-50">
                <div className="flex-grow">
                    <span className="font-semibold text-blue-800">{selectedIds.length}</span> items selected.
                </div>
                 <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBatchEditDialogOpen(true)}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Batch Edit
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        Change Status
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => handleBatchStatusUpdate('approved')}>
                         <Flag className="mr-2 h-4 w-4 text-green-500" /> Mark as Approved
                      </DropdownMenuItem>
                       <DropdownMenuItem onClick={() => handleBatchStatusUpdate('needs-review')}>
                         <Flag className="mr-2 h-4 w-4 text-yellow-500" /> Mark as Needs Review
                      </DropdownMenuItem>
                       <DropdownMenuItem onClick={() => handleBatchStatusUpdate('incorrect')}>
                         <Flag className="mr-2 h-4 w-4 text-red-500" /> Mark as Incorrect
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
              </div>
            )}
          </div>


          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px] p-2">
                  <Checkbox 
                    checked={selectedIds.length === sortedTransactions.length && sortedTransactions.length > 0}
                    onCheckedChange={(checked) => handleSelectAll(!!checked)}
                  />
                </TableHead>
                <TableHead className="p-2"><Button variant="ghost" onClick={() => requestSort('date')}>Date {getSortIcon('date')}</Button></TableHead>
                <TableHead className="p-2"><Button variant="ghost" onClick={() => requestSort('description')}>Description {getSortIcon('description')}</Button></TableHead>
                <TableHead className="p-2"><Button variant="ghost" onClick={() => requestSort('category')}>Category {getSortIcon('category')}</Button></TableHead>
                <TableHead className="text-right p-2"><Button variant="ghost" onClick={() => requestSort('amount')}>Amount {getSortIcon('amount')}</Button></TableHead>
                <TableHead className="text-right p-2 w-[80px]">
                    <Button variant="ghost" size="icon" onClick={() => requestSort('reviewStatus')}>
                        <Flag className="h-4 w-4" />
                        {getSortIcon('reviewStatus')}
                    </Button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : sortedTransactions.length > 0 ? (
                sortedTransactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                     <TableCell className="p-2">
                        <Checkbox 
                            checked={selectedIds.includes(transaction.id)}
                            onCheckedChange={(checked) => handleSelectionChange(transaction.id, !!checked)}
                        />
                    </TableCell>
                    <TableCell className="align-top py-4"><div className="text-sm text-muted-foreground">{new Date(transaction.date).toLocaleDateString()}</div></TableCell>
                    <TableCell className="align-top py-4"><div className="font-medium max-w-[300px]">{transaction.description}</div></TableCell>
                    <TableCell className="align-top py-4">
                      <div className="flex flex-col gap-1">
                          <CategoryEditor transaction={transaction} onSave={handleCategoryChange} />
                      </div>
                    </TableCell>
                    <TableCell className={cn('text-right font-medium align-top py-4', transaction.amount > 0 ? 'text-green-600' : 'text-foreground')}>
                      {transaction.amount > 0 ? '+' : ''}{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(transaction.amount)}
                    </TableCell>
                     <TableCell className="align-top py-4 text-right">
                       <StatusFlagEditor transaction={transaction} dataSource={dataSource} />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={6} className="h-24 text-center">No transactions found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {dataSource && <UploadTransactionsDialog isOpen={isUploadDialogOpen} onOpenChange={setUploadDialogOpen} dataSource={dataSource} />}
      {isBatchEditDialogOpen && (
        <BatchEditDialog
          isOpen={isBatchEditDialogOpen}
          onOpenChange={setBatchEditDialogOpen}
          transactions={selectedTransactions}
          dataSource={dataSource}
          onSuccess={() => setSelectedIds([])}
        />
      )}
      <AlertDialog open={isClearAlertOpen} onOpenChange={setClearAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete all transactions for <strong>{dataSource.accountName}</strong> and reset the sync history. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className={buttonVariants({ variant: "destructive" })} onClick={handleClearTransactions}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function StatusFlagEditor({ transaction, dataSource }: { transaction: Transaction; dataSource: DataSource; }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const handleStatusChange = async (newStatus: 'needs-review' | 'approved' | 'incorrect') => {
    if (!user || !firestore) return;
    const transactionRef = doc(firestore, `users/${user.uid}/bankAccounts/${dataSource.id}/transactions`, transaction.id);
    try {
      await updateDoc(transactionRef, { reviewStatus: newStatus });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not update status.' });
    }
  };

  const statusColor = {
    'approved': 'text-green-500',
    'needs-review': 'text-yellow-500',
    'incorrect': 'text-red-500',
  }[transaction.reviewStatus || 'needs-review'];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
            <Flag className={`h-4 w-4 ${statusColor}`} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleStatusChange('approved')}>
          <Flag className="mr-2 h-4 w-4 text-green-500" /> Approved
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleStatusChange('needs-review')}>
          <Flag className="mr-2 h-4 w-4 text-yellow-500" /> Needs Review
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleStatusChange('incorrect')}>
          <Flag className="mr-2 h-4 w-4 text-red-500" /> Incorrect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


function CategoryEditor({ transaction, onSave }: { transaction: Transaction, onSave: (tx: Transaction, cats: { primaryCategory: string, secondaryCategory: string, subcategory: string, details: string }) => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const cats = transaction.categoryHierarchy || { l0: transaction.primaryCategory, l1: transaction.secondaryCategory, l2: transaction.subcategory, l3: transaction.details || '' };
    
    const [primary, setPrimary] = useState(cats.l0);
    const [secondary, setSecondary] = useState(cats.l1);
    const [sub, setSub] = useState(cats.l2);
    const [details, setDetails] = useState(cats.l3);

    const [alertState, setAlertState] = useState<{ type: 'none' | 'negativeIncome' | 'securityDeposit' | 'thankYouPayment', isOpen: boolean }>({ type: 'none', isOpen: false });

    const finalizeSave = (cats: { primaryCategory: string, secondaryCategory: string, subcategory: string, details: string }) => {
        onSave(transaction, cats);
        setIsOpen(false);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const cats = { primaryCategory: primary, secondaryCategory: secondary, subcategory: sub, details: details };
        finalizeSave(cats);
    };

    return (
        <>
            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <div className="flex flex-col cursor-pointer group hover:opacity-80 transition-opacity items-start">
                        <Badge variant="outline" className={cn('w-fit border-0 font-semibold px-2 py-1', primaryCategoryColors[cats.l0] || 'bg-slate-100')}>
                            {cats.l0}
                            <Pencil className="ml-2 h-3 w-3 opacity-0 group-hover:opacity-100" />
                        </Badge>
                        <span className="text-xs text-muted-foreground pl-1 mt-0.5">
                            {cats.l1} {'>'} {cats.l2}
                        </span>
                        {cats.l3 && (
                             <span className="text-xs text-muted-foreground pl-1 font-medium">
                                {cats.l3}
                            </span>
                        )}
                    </div>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                    <form onSubmit={handleSubmit} className="grid gap-4">
                        <div className="space-y-2">
                            <h4 className="font-medium leading-none">Edit Category</h4>
                            <p className="text-sm text-muted-foreground">Confirm or correct the assignment.</p>
                        </div>
                        <div className="grid gap-2">
                            <div className="grid grid-cols-3 items-center gap-4"><Label htmlFor="primary">L0</Label><Input id="primary" value={primary} onChange={(e) => setPrimary(e.target.value)} className="col-span-2 h-8" /></div>
                            <div className="grid grid-cols-3 items-center gap-4"><Label htmlFor="secondary">L1</Label><Input id="secondary" value={secondary} onChange={(e) => setSecondary(e.target.value)} className="col-span-2 h-8" /></div>
                            <div className="grid grid-cols-3 items-center gap-4"><Label htmlFor="sub">L2</Label><Input id="sub" value={sub} onChange={(e) => setSub(e.target.value)} className="col-span-2 h-8" /></div>
                             <div className="grid grid-cols-3 items-center gap-4"><Label htmlFor="details">L3</Label><Input id="details" value={details} onChange={(e) => setDetails(e.target.value)} className="col-span-2 h-8" /></div>
                        </div>
                        <Button type="submit">Confirm & Save</Button>
                    </form>
                </PopoverContent>
            </Popover>
        </>
    );
}
