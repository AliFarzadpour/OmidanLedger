
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, writeBatch, getDocs, query, collectionGroup, where, updateDoc } from 'firebase/firestore';
import { Button, buttonVariants } from '@/components/ui/button';
import { PlusCircle, Upload, ArrowLeft, Trash2, BookOpen, ToggleRight, ToggleLeft, RefreshCw, DollarSign, Wallet, Banknote } from 'lucide-react';
import { DataSourceDialog } from '@/components/dashboard/transactions/data-source-dialog';
import { DataSourceList } from '@/components/dashboard/transactions/data-source-list';
import { TransactionsTable } from '@/components/dashboard/transactions/transactions-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import type { Transaction } from '@/components/dashboard/transactions-table';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { syncAndCategorizePlaidTransactions } from '@/lib/plaid';
import { getAndUpdatePlaidBalances } from '@/actions/plaid-actions';
import { differenceInHours, formatDistanceToNowStrict } from 'date-fns';
import { formatCurrency } from '@/lib/format';

// Define the shape of a data source for type safety
interface DataSource {
  id: string;
  accountName: string;
  bankName: string;
  accountType: 'checking' | 'savings' | 'credit-card' | 'cash';
  accountNumber?: string;
  plaidAccessToken?: string;
  plaidAccountId?: string;
  lastSyncedAt?: { seconds: number; nanoseconds: number } | Date;
  historicalDataPending?: boolean;
}

interface BalanceData {
    currentBalance: number | null;
    availableBalance: number | null;
    limit: number | null;
    currency: string;
    lastUpdatedAt: { seconds: number, nanoseconds: number } | Date;
}


export default function TransactionsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [isDialogOpen, setDialogOpen] = useState(false);
  const [editingDataSource, setEditingDataSource] = useState<DataSource | null>(null);
  const [selectedDataSource, setSelectedDataSource] = useState<DataSource | null>(null);
  
  const [isDeleteAlertOpen, setDeleteAlertOpen] = useState(false);
  const [deletingDataSource, setDeletingDataSource] = useState<DataSource | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());

  const userDocRef = useMemoFirebase(() => user ? doc(firestore, `users/${user.uid}`) : null, [user, firestore]);
  const { data: userData, isLoading: isLoadingUser } = useDoc(userDocRef);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  
  // Balances state
  const balancesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(firestore, `users/${user.uid}/bankBalances`);
  }, [user, firestore]);
  const { data: balanceDocs, isLoading: isLoadingBalances } = useCollection(balancesQuery);

  const balances = useMemo(() => {
      if (!balanceDocs) return {};
      return balanceDocs.reduce((acc, doc) => {
          acc[doc.id] = doc as BalanceData;
          return acc;
      }, {} as Record<string, BalanceData>);
  }, [balanceDocs]);


  const handleRefreshBalances = useCallback(async () => {
    if (!user) return;
    toast({ title: 'Refreshing Balances...', description: 'Fetching latest data from your banks.' });
    try {
        await getAndUpdatePlaidBalances(user.uid);
        toast({ title: 'Balances Updated!', description: 'Your bank-reported balances are now up to date.' });
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Refresh Failed', description: e.message });
    }
  }, [user, toast]);

  useEffect(() => {
    if (!user) return; // Don't run if user is not available
    const shouldRefresh = () => {
      if (Object.keys(balances).length === 0) return true; // No balances, fetch immediately
      
      const oldestUpdate = Object.values(balances).reduce((oldest, current) => {
        const currentDate = current.lastUpdatedAt instanceof Date ? current.lastUpdatedAt : new Date((current.lastUpdatedAt as any).seconds * 1000);
        if (currentDate < oldest) return currentDate;
        return oldest;
      }, new Date());
      
      return differenceInHours(new Date(), oldestUpdate) > 4;
    };

    if (shouldRefresh()) {
      handleRefreshBalances();
    }
  }, [balances, handleRefreshBalances, user]);


  useEffect(() => {
    if (userData && typeof userData.plaidAutoSyncEnabled === 'boolean') {
      setAutoSyncEnabled(userData.plaidAutoSyncEnabled);
    } else if (userData && userData.plaidAutoSyncEnabled === undefined) {
      setAutoSyncEnabled(true);
    }
  }, [userData]);

  const handleAutoSyncToggle = async (enabled: boolean) => {
    if (!userDocRef) return;
    setAutoSyncEnabled(enabled); // Optimistic UI update
    try {
      await updateDoc(userDocRef, { plaidAutoSyncEnabled: enabled });
      toast({
        title: `Auto-Sync ${enabled ? 'Enabled' : 'Disabled'}`,
        description: `Your accounts will ${enabled ? 'now' : 'no longer'} sync automatically.`,
      });
    } catch (error) {
      console.error('Failed to update auto-sync setting:', error);
      setAutoSyncEnabled(!enabled); // Revert on error
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not save your auto-sync preference.',
      });
    }
  };

  const bankAccountsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, `users/${user.uid}/bankAccounts`);
  }, [firestore, user]);

  const { data: dataSources, isLoading: isLoadingDataSources, refetch: refetchDataSources } = useCollection<DataSource>(bankAccountsQuery);
  
  const handleSync = useCallback(async (accountId: string) => {
    if (!user) return;
    setSyncingIds(prev => new Set(prev).add(accountId));
    try {
      await syncAndCategorizePlaidTransactions({ userId: user.uid, bankAccountId: accountId });
      toast({ title: 'Sync Complete!', description: `Account successfully synced.` });
      refetchDataSources();
    } catch (error: any) {
      toast({ variant: 'destructive', title: `Sync Failed`, description: error.message });
    } finally {
      setSyncingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(accountId);
        return newSet;
      });
    }
  }, [user, toast, refetchDataSources]);


  useEffect(() => {
    if (dataSources && dataSources.length > 0 && autoSyncEnabled && user) {
      const accountToSync = dataSources.find(source => {
        if (!source.plaidAccessToken || syncingIds.has(source.id)) {
          return false;
        }
        const now = new Date();
        const lastSyncedDate = source.lastSyncedAt 
          ? (source.lastSyncedAt as any).toDate ? (source.lastSyncedAt as any).toDate() : new Date((source.lastSyncedAt as any).seconds * 1000)
          : new Date(0);
        const hoursSinceLastSync = differenceInHours(now, lastSyncedDate);
        return hoursSinceLastSync > 12 || source.historicalDataPending;
      });

      if (accountToSync) {
        handleSync(accountToSync.id);
      }
    }
  }, [dataSources, autoSyncEnabled, user, handleSync, syncingIds]);


  const allTransactionsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collectionGroup(firestore, 'transactions'), where('userId', '==', user.uid));
  }, [firestore, user]);

  const { data: allTransactions, isLoading: isLoadingTransactions } = useCollection<Transaction>(allTransactionsQuery);

  const flagCounts = useMemo(() => {
    if (!allTransactions) return {};
    return allTransactions.reduce((acc, tx) => {
        const accountId = tx.bankAccountId;
        if (!accountId) return acc;
        if (!acc[accountId]) {
            acc[accountId] = { needsReview: 0, incorrect: 0 };
        }
        if (tx.reviewStatus === 'needs-review') {
            acc[accountId].needsReview++;
        } else if (tx.reviewStatus === 'incorrect') {
            acc[accountId].incorrect++;
        }
        return acc;
    }, {} as Record<string, { needsReview: number; incorrect: number }>);
  }, [allTransactions]);
  
  const totalCash = useMemo(() => {
    if (!dataSources || !balances) return 0;
    return dataSources.reduce((sum, source) => {
        if (source.accountType === 'checking' || source.accountType === 'savings') {
            const balance = balances[source.plaidAccountId!]?.currentBalance;
            if (typeof balance === 'number') {
                return sum + balance;
            }
        }
        return sum;
    }, 0);
  }, [dataSources, balances]);

  const handleAdd = () => {
    setEditingDataSource(null);
    setDialogOpen(true);
  };

  const handleEdit = (dataSource: DataSource) => {
    setEditingDataSource(dataSource);
    setDialogOpen(true);
  };
  
  const handleSelectDataSource = (dataSource: DataSource) => {
    setSelectedDataSource(dataSource);
  };
  
  const handleDeleteRequest = (dataSource: DataSource) => {
    setDeletingDataSource(dataSource);
    setDeleteAlertOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!firestore || !user || !deletingDataSource) return;
    setIsDeleting(true);
    
    try {
        const batch = writeBatch(firestore);
        const accountRef = doc(firestore, `users/${user.uid}/bankAccounts`, deletingDataSource.id);
        
        const transactionsToDeleteQuery = query(collection(accountRef, 'transactions'));
        const transactionsToDeleteSnap = await getDocs(transactionsToDeleteQuery);
        transactionsToDeleteSnap.forEach(txDoc => {
            batch.delete(txDoc.ref);
        });

        batch.delete(accountRef);
        await batch.commit();
        
        toast({
            title: "Data Source Deleted",
            description: `${deletingDataSource.accountName} and all its transactions have been removed.`,
        });

        setDeletingDataSource(null);
        setDeleteAlertOpen(false);
        if (selectedDataSource?.id === deletingDataSource.id) {
            setSelectedDataSource(null);
        }
        refetchDataSources();
        
    } catch (error) {
        console.error("Error deleting data source:", error);
        toast({
            variant: "destructive",
            title: "Deletion Failed",
            description: "Could not delete the data source. Please try again.",
        });
    } finally {
        setIsDeleting(false);
    }
  };


  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingDataSource(null);
    refetchDataSources();
  };
  
  const lastSyncTime = useMemo(() => {
      if (!dataSources || dataSources.length === 0) return null;
      let mostRecent: Date | null = null;
      dataSources.forEach(source => {
          if (source.lastSyncedAt) {
              const d = source.lastSyncedAt instanceof Date ? source.lastSyncedAt : new Date((source.lastSyncedAt as any).seconds * 1000);
              if (!mostRecent || d > mostRecent) {
                  mostRecent = d;
              }
          }
      });
      return mostRecent;
  }, [dataSources]);

  return (
    <>
    <div className="space-y-6 p-8 max-w-7xl mx-auto">
      
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard')}>
                <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="space-y-1">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Transactions</h1>
                <p className="text-muted-foreground">Manage your data sources and view your transactions.</p>
            </div>
        </div>
        <div className="flex items-center gap-4">
            {isLoadingUser ? <Skeleton className="h-6 w-32" /> : (
              <div className="flex items-center space-x-2 bg-muted/60 p-2 rounded-lg">
                {autoSyncEnabled ? <ToggleRight className="h-5 w-5 text-primary" /> : <ToggleLeft className="h-5 w-5 text-slate-400" />}
                <div className="flex flex-col">
                  <Label htmlFor="autosync-toggle" className="text-sm font-medium leading-none">Plaid Auto-Sync</Label>
                  {lastSyncTime && (
                    <span className="text-xs text-muted-foreground">
                      Last: {formatDistanceToNowStrict(lastSyncTime, { addSuffix: true })}
                    </span>
                  )}
                </div>
                <Switch 
                  id="autosync-toggle"
                  checked={autoSyncEnabled} 
                  onCheckedChange={handleAutoSyncToggle}
                />
              </div>
            )}
            <Button onClick={handleAdd} className="gap-2">
                <Banknote className="h-4 w-4" />
                Connect Bank or Card
            </Button>
        </div>
      </div>

      <Card className="bg-slate-50 border-slate-200">
        <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="p-3 bg-green-100 rounded-lg">
                    <Wallet className="h-6 w-6 text-green-700" />
                </div>
                <div>
                    <Label className="text-sm text-muted-foreground">Total Cash Balance</Label>
                    <p className="text-2xl font-bold text-slate-800">{formatCurrency(totalCash)}</p>
                </div>
            </div>
            <p className="text-xs text-muted-foreground max-w-xs">
                This is the sum of all 'checking' and 'savings' accounts as reported by your bank. It may include pending transactions.
            </p>
             <Button variant="ghost" size="sm" onClick={handleRefreshBalances} className="text-xs text-muted-foreground gap-2">
                <RefreshCw className="h-3 w-3" /> Refresh Bank Balances (Plaid)
            </Button>
        </CardContent>
      </Card>

      <DataSourceList 
        dataSources={dataSources || []} 
        balances={balances}
        isLoading={isLoadingDataSources || isLoadingTransactions || isLoadingBalances}
        flagCounts={flagCounts}
        onEdit={handleEdit}
        onSelect={handleSelectDataSource}
        onDelete={handleDeleteRequest}
        onSync={handleSync}
        onRefreshBalances={handleRefreshBalances}
        selectedDataSourceId={selectedDataSource?.id}
        syncingIds={syncingIds}
      />
      
      {selectedDataSource && (
          <TransactionsTable 
            dataSource={selectedDataSource} 
          />
      )}

      <DataSourceDialog
        isOpen={isDialogOpen}
        onOpenChange={handleDialogClose}
        dataSource={editingDataSource}
      />
    </div>

    <AlertDialog open={isDeleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deletingDataSource?.accountName}</strong> and all of its transactions. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
                className={buttonVariants({ variant: "destructive" })} 
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Yes, Delete Everything'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
    </>
  );
}
