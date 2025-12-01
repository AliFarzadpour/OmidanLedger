'use client';

import { useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { AddDataSourceDialog } from '@/components/dashboard/transactions/add-data-source-dialog';
import { DataSourceList } from '@/components/dashboard/transactions/data-source-list';

export default function TransactionsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [isAddDialogOpen, setAddDialogOpen] = useState(false);

  const bankAccountsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, `users/${user.uid}/bankAccounts`);
  }, [firestore, user]);

  const { data: dataSources, isLoading: isLoadingDataSources } = useCollection(bankAccountsQuery);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground">Manage your data sources and transactions.</p>
        </div>
        <Button onClick={() => setAddDialogOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Data Source
        </Button>
      </div>

      <DataSourceList dataSources={dataSources || []} isLoading={isLoadingDataSources} />
      
      <AddDataSourceDialog
        isOpen={isAddDialogOpen}
        onOpenChange={setAddDialogOpen}
      />
    </div>
  );
}
