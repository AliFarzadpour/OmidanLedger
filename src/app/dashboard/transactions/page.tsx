
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, writeBatch, getDocs, query, collectionGroup, where, setDoc } from 'firebase/firestore';
import { Button, buttonVariants } from '@/components/ui/button';
import { PlusCircle, Upload, ArrowLeft, Trash2, BookOpen, ToggleRight, ToggleLeft } from 'lucide-react';
import { DataSourceDialog } from '@/components/dashboard/transactions/data-source-dialog';
import { DataSourceList } from '@/components/dashboard/transactions/data-source-list';
import { TransactionsTable } from '@/components/dashboard/transactions-table';
import { Card, CardContent } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import type { Transaction } from '@/components/dashboard/transactions-table';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

// Define the shape of a data source for type safety
interface DataSource {
  id: string;
  accountName: string;
  bankName: string;
  accountType: 'checking' | 'savings' | 'credit-card' | 'cash';
  accountNumber?: string;
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

  // New state for auto-sync toggle
  const userDocRef = useMemoFirebase(() => user ? doc(firestore, `users/${user.uid}`) : null, [user, firestore]);
  const { data: userData, isLoading: isLoadingUser } = useDoc(userDocRef);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);

  useEffect(() => {
    if (userData && typeof userData.plaidAutoSyncEnabled === 'boolean') {
      setAutoSyncEnabled(userData.plaidAutoSyncEnabled);
    }
  }, [userData]);

  const handleAutoSyncToggle = async (enabled: boolean) => {
    if (!userDocRef) return;
    setAutoSyncEnabled(enabled); // Optimistic UI update
    try {
      await setDoc(userDocRef, { plaidAutoSyncEnabled: enabled }, { merge: true });
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

  const { data: dataSources, isLoading: isLoadingDataSources } = useCollection<DataSource>(bankAccountsQuery);
  
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
    }, {} as Record<string, { needsReview: number, incorrect: number }>);
  }, [allTransactions]);

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
        
        const transactionsToDelete = allTransactions?.filter(tx => tx.bankAccountId === deletingDataSource.id) || [];
        transactionsToDelete.forEach(tx => {
            const txRef = doc(accountRef, 'transactions', tx.id);
            batch.delete(txRef);
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
  };

  return (
    <>
    <div className="space-y-8 p-8 max-w-7xl mx-auto">
      
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
                <Label htmlFor="autosync-toggle" className="text-sm font-medium">Plaid Auto-Sync</Label>
                <Switch 
                  id="autosync-toggle"
                  checked={autoSyncEnabled} 
                  onCheckedChange={handleAutoSyncToggle}
                />
              </div>
            )}
            <Button onClick={handleAdd}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Data Source
            </Button>
        </div>
      </div>

      <DataSourceList 
        dataSources={dataSources || []} 
        isLoading={isLoadingDataSources || isLoadingTransactions}
        flagCounts={flagCounts}
        onEdit={handleEdit}
        onSelect={handleSelectDataSource}
        onDelete={handleDeleteRequest}
        selectedDataSourceId={selectedDataSource?.id}
      />
      
      {selectedDataSource ? (
          <TransactionsTable dataSource={selectedDataSource} />
      ) : (
        <Card className="flex items-center justify-center h-64 border-dashed">
            <CardContent className="pt-6 text-center">
                 <p className="text-muted-foreground">Select a data source above to view its transactions.</p>
            </CardContent>
        </Card>
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
              This will permanently delete <strong>{deletingDataSource?.accountName}</strong> and all of its associated transactions. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
                className={buttonVariants({ variant: "destructive" })} 
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Yes, Delete Everything"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
    </>
  );
}
