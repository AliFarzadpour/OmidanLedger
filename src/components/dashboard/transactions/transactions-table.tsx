'use client';

import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
import { Upload, ArrowUpDown, Trash2, Pencil, RefreshCw, CheckCircle2, AlertTriangle, HelpCircle } from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, writeBatch, getDocs, setDoc } from 'firebase/firestore';
import { UploadTransactionsDialog } from './upload-transactions-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { learnCategoryMapping } from '@/ai/flows/learn-category-mapping';
import { syncAndCategorizePlaidTransactions } from '@/ai/flows/plaid-flows';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TransactionToolbar } from './transaction-toolbar';

const primaryCategoryColors: Record<string, string> = {
  'Income': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  'Cost of Goods Sold': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  'Operating Expenses': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  'Other Expenses': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  'Balance Sheet Categories': 'bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
};

interface DataSource {
  id: string;
  accountName: string;
  bankName: string;
  plaidAccessToken?: string;
}

interface Transaction {
  id: string;
  date: string;
  description: string;
  primaryCategory: string;
  secondaryCategory: string;
  subcategory: string;
  amount: number;
  confidence?: number;
  accountId?: string;
  accountName?: string; 
  status?: 'posted' | 'review' | 'error' | 'ready';
}

type SortKey = 'date' | 'description' | 'category' | 'amount';
type SortDirection = 'ascending' | 'descending';

interface TransactionsTableProps {
  dataSource: DataSource;
}

export function TransactionsTable({ dataSource }: TransactionsTableProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [isUploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isClearAlertOpen, setClearAlertOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'date', direction: 'descending' });
  const [filterTerm, setFilterTerm] = useState('');
  const [filterDate, setFilterDate] = useState<Date | undefined>();
  const [filterCategory, setFilterCategory] = useState('');

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
        await batch.commit();
        toast({ title: "Transactions Cleared", description: "All transactions deleted." });
    } catch (error) { console.error(error); } 
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

  const handleCategoryChange = async (transaction: Transaction, newCategories: { primaryCategory: string; secondaryCategory: string; subcategory: string; }) => {
    if (!firestore || !user) return;
    const transactionRef = doc(firestore, `users/${user.uid}/bankAccounts/${dataSource.id}/transactions`, transaction.id);
    
    await setDoc(transactionRef, { 
        ...newCategories,
        confidence: 1.0, 
        status: 'posted' 
    }, { merge: true });

    await learnCategoryMapping({
        transactionDescription: transaction.description,
        primaryCategory: newCategories.primaryCategory,
        secondaryCategory: newCategories.secondaryCategory,
        subcategory: newCategories.subcategory,
        userId: user.uid,
    });
    toast({ title: "Updated", description: "Category saved." });
  };

  const sortedTransactions = useMemo(() => {
    if (!transactions) return [];
    let filtered = transactions.filter(t => {
       const matchesSearch = t.description.toLowerCase().includes(filterTerm.toLowerCase()) || t.amount.toString().includes(filterTerm);
       const matchesCategory = filterCategory && filterCategory !== 'all' ? t.primaryCategory === filterCategory : true;
       const matchesDate = filterDate ? new Date(t.date).toDateString() === filterDate.toDateString() : true;
       return matchesSearch && matchesCategory && matchesDate;
    });

    filtered.sort((a, b) => {
      let aValue: any = a[sortConfig.key as keyof Transaction] || '';
      let bValue: any = b[sortConfig.key as keyof Transaction] || '';
      if (sortConfig.key === 'category') {
        aValue = `${a.primaryCategory}${a.secondaryCategory}${a.subcategory}`;
        bValue = `${b.primaryCategory}${b.secondaryCategory}${b.subcategory}`;
      } else if (sortConfig.key === 'date') {
        return sortConfig.direction === 'ascending' ? new Date(a.date).getTime() - new Date(b.date).getTime() : new Date(b.date).getTime() - new Date(a.date).getTime();
      }
      if (typeof aValue === 'string') return sortConfig.direction === 'ascending' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      return sortConfig.direction === 'ascending' ? aValue - bValue : bValue - aValue;
    });
    return filtered;
  }, [transactions, sortConfig, filterTerm, filterDate, filterCategory]);

  const requestSort = (key: SortKey) => {
    setSortConfig({ key, direction: sortConfig.key === key && sortConfig.direction === 'ascending' ? 'descending' : 'ascending' });
  };
  
  const getSortIcon = (key: SortKey) => sortConfig.key === key ? <ArrowUpDown className="ml-2 h-4 w-4" /> : <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />;

  return (
    <>
      <Card className="h-full shadow-lg">
        <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <CardTitle>Transactions for {dataSource.accountName}</CardTitle>
            <CardDescription>Showing all transactions from {dataSource.bankName}.</CardDescription>
          </div>
          <div className="flex gap-2">
            {dataSource.plaidAccessToken ? (
              <Button onClick={handleSyncTransactions} disabled={isSyncing}><RefreshCw className={cn("mr-2 h-4 w-4", isSyncing && "animate-spin")} /> Sync</Button>
            ) : (
              <Button onClick={() => setUploadDialogOpen(true)}><Upload className="mr-2 h-4 w-4" /> Upload Statement</Button>
            )}
            <Button variant="destructive" onClick={() => setClearAlertOpen(true)} disabled={!transactions || transactions.length === 0 || isClearing}><Trash2 className="mr-2 h-4 w-4" /> Clear</Button>
          </div>
        </CardHeader>
        
        <CardContent>
          <TransactionToolbar 
              onSearch={setFilterTerm}
              onDateChange={setFilterDate}
              onCategoryFilter={setFilterCategory}
              onClear={() => { setFilterTerm(''); setFilterDate(undefined); setFilterCategory(''); }}
          />

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="p-2"><Button variant="ghost" onClick={() => requestSort('date')}>Date {getSortIcon('date')}</Button></TableHead>
                <TableHead className="p-2"><Button variant="ghost" onClick={() => requestSort('description')}>Description {getSortIcon('description')}</Button></TableHead>
                <TableHead className="p-2"><Button variant="ghost" onClick={() => requestSort('category')}>Category {getSortIcon('category')}</Button></TableHead>
                <TableHead className="text-right p-2"><Button variant="ghost" onClick={() => requestSort('amount')}>Amount {getSortIcon('amount')}</Button></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={4}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                ))
              ) : sortedTransactions.length > 0 ? (
                sortedTransactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="align-top py-4"><div className="text-sm text-muted-foreground">{new Date(transaction.date).toLocaleDateString()}</div></TableCell>
                    <TableCell className="align-top py-4"><div className="font-medium max-w-[300px]">{transaction.description}</div></TableCell>
                    <TableCell className="align-top py-4">
                      {/* THIS COMPONENT NOW WRAPS THE BADGE & STATUS */}
                      <CategoryEditor 
                          transaction={transaction} 
                          onSave={handleCategoryChange} 
                          displayName={transaction.accountName} 
                      />
                    </TableCell>
                    <TableCell className={cn('text-right font-medium align-top py-4', transaction.amount > 0 ? 'text-green-600' : 'text-foreground')}>
                      {transaction.amount > 0 ? '+' : ''}{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(transaction.amount)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={4} className="h-24 text-center">No transactions found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {dataSource && <UploadTransactionsDialog isOpen={isUploadDialogOpen} onOpenChange={setUploadDialogOpen} dataSource={dataSource} />}
      <AlertDialog open={isClearAlertOpen} onOpenChange={setClearAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete all transactions for <strong>{dataSource.accountName}</strong>.</AlertDialogDescription>
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

// --- CATEGORY EDITOR (Wraps everything to make it clickable) ---
function CategoryEditor({ transaction, onSave, displayName }: { transaction: Transaction, onSave: any, displayName?: string }) {
    const [isOpen, setIsOpen] = useState(false);
    const [primary, setPrimary] = useState(transaction.primaryCategory);
    const [secondary, setSecondary] = useState(transaction.secondaryCategory);
    const [sub, setSub] = useState(transaction.subcategory);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(transaction, { primaryCategory: primary, secondaryCategory: secondary, subcategory: sub });
        setIsOpen(false);
    };

    // Determine Status Badge inside the component
    let StatusBadge = null;
    if (transaction.status !== 'posted') {
        if ((transaction.confidence || 0) > 0.8 && transaction.accountId) {
            StatusBadge = (
                <div className="flex items-center gap-1 w-fit text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px] font-medium border border-emerald-100 mt-1">
                    <CheckCircle2 className="h-3 w-3" /> <span>Auto-Matched</span>
                </div>
            );
        } else if (transaction.accountId) {
            StatusBadge = (
                <div className="flex items-center gap-1 w-fit text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full text-[10px] font-medium border border-amber-100 mt-1">
                    <HelpCircle className="h-3 w-3" /> <span>Review Needed</span>
                </div>
            );
        } else {
            StatusBadge = (
                <div className="flex items-center gap-1 w-fit text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full text-[10px] font-medium border border-slate-200 mt-1">
                    <AlertTriangle className="h-3 w-3" /> <span>Unassigned</span>
                </div>
            );
        }
    }
    
    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <div className="flex flex-col cursor-pointer group hover:opacity-80 transition-opacity">
                    {/* 1. Show Account Name OR Generic Badge */}
                    {displayName ? (
                         <div className="flex flex-col">
                            <span className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                               {displayName}
                               <Pencil className="h-3 w-3 text-slate-400 opacity-0 group-hover:opacity-100" />
                            </span>
                            <span className="text-xs text-muted-foreground">AI: {transaction.subcategory}</span>
                         </div>
                    ) : (
                        <Badge variant="outline" className={cn('w-fit border-0 font-semibold px-2 py-1', primaryCategoryColors[transaction.primaryCategory] || 'bg-slate-100')}>
                            {transaction.primaryCategory}
                            <Pencil className="ml-2 h-3 w-3 opacity-50" />
                        </Badge>
                    )}

                    {/* 2. Show Status Badge (Clickable now because it's inside the trigger) */}
                    {StatusBadge}
                </div>
            </PopoverTrigger>
            <PopoverContent className="w-80">
                <form onSubmit={handleSubmit} className="grid gap-4">
                    <div className="space-y-2">
                        <h4 className="font-medium leading-none">Edit Category</h4>
                        <p className="text-sm text-muted-foreground">Confirm or correct the assignment.</p>
                    </div>
                    <div className="grid gap-2">
                        <div className="grid grid-cols-3 items-center gap-4"><Label htmlFor="primary">Primary</Label><Input id="primary" value={primary} onChange={(e) => setPrimary(e.target.value)} className="col-span-2 h-8" /></div>
                        <div className="grid grid-cols-3 items-center gap-4"><Label htmlFor="secondary">Secondary</Label><Input id="secondary" value={secondary} onChange={(e) => setSecondary(e.target.value)} className="col-span-2 h-8" /></div>
                        <div className="grid grid-cols-3 items-center gap-4"><Label htmlFor="sub">Sub</Label><Input id="sub" value={sub} onChange={(e) => setSub(e.target.value)} className="col-span-2 h-8" /></div>
                    </div>
                    <Button type="submit">Confirm & Save</Button>
                </form>
            </PopoverContent>
        </Popover>
    );
}
