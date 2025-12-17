'use client';

import { useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { PlusCircle, Upload } from 'lucide-react';
import { DataSourceDialog } from '@/components/dashboard/transactions/data-source-dialog';
import { DataSourceList } from '@/components/dashboard/transactions/data-source-list';
import { TransactionsTable } from '@/components/dashboard/transactions-table';
import { Card, CardContent } from '@/components/ui/card';

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
  const [selectedDataSource, setSelectedDataSource] = useState<DataSource | null>(null);

  const bankAccountsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, `users/${user.uid}/bankAccounts`);
  }, [firestore, user]);

  const { data: dataSources, isLoading: isLoadingDataSources } = useCollection<DataSource>(bankAccountsQuery);

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

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingDataSource(null);
  };

  return (
    <div className="space-y-8 p-8 max-w-7xl mx-auto">
      
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Transactions</h1>
          <p className="text-muted-foreground">Manage your data sources and view your transactions.</p>
        </div>
        <Button onClick={handleAdd}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Data Source
        </Button>
      </div>

      <DataSourceList 
        dataSources={dataSources || []} 
        isLoading={isLoadingDataSources}
        onEdit={handleEdit}
        onSelect={handleSelectDataSource}
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
  );
}
