'use client';

import { useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { DataSourceDialog } from '@/components/dashboard/transactions/data-source-dialog';
import { DataSourceList } from '@/components/dashboard/transactions/data-source-list';

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
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [editingDataSource, setEditingDataSource] = useState<DataSource | null>(null);

  const bankAccountsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, `users/${user.uid}/bankAccounts`);
  }, [firestore, user]);

  const { data: dataSources, isLoading: isLoadingDataSources } = useCollection(bankAccountsQuery);

  const handleAdd = () => {
    setEditingDataSource(null);
    setDialogOpen(true);
  };

  const handleEdit = (dataSource: DataSource) => {
    setEditingDataSource(dataSource);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingDataSource(null);
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground">Manage your data sources and transactions.</p>
        </div>
        <Button onClick={handleAdd}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Data Source
        </Button>
      </div>

      <DataSourceList 
        dataSources={(dataSources as DataSource[]) || []} 
        isLoading={isLoadingDataSources}
        onEdit={handleEdit}
      />
      
      <DataSourceDialog
        isOpen={isDialogOpen}
        onOpenChange={handleDialogClose}
        dataSource={editingDataSource}
      />
    </div>
  );
}
