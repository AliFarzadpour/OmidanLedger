'use client';

import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useParams, notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { TransactionsTable } from '@/components/dashboard/transactions-table';
import { Skeleton } from '@/components/ui/skeleton';
import { Upload } from 'lucide-react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

interface BankAccount {
  id: string;
  accountName: string;
  bankName: string;
}

export default function AccountTransactionsPage() {
  const { accountId } = useParams();
  const { user } = useUser();
  const firestore = useFirestore();

  const accountDocRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid || !accountId) return null;
    return doc(firestore, 'users', user.uid, 'bankAccounts', accountId as string);
  }, [firestore, user?.uid, accountId]);

  const { data: account, isLoading } = useDoc<BankAccount>(accountDocRef);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-8">
        <Skeleton className="h-8 w-1/4" />
        <Skeleton className="h-4 w-1/2" />
        <div className="flex justify-end">
          <Skeleton className="h-10 w-48" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!account) {
    // This will render the not-found.tsx file if the account doesn't exist
    notFound();
  }

  return (
    <div className="flex flex-col gap-8">
       <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button asChild variant="outline" size="icon">
            <Link href="/dashboard/transactions">
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{account.accountName}</h1>
            <p className="text-muted-foreground">
              {account.bankName}
            </p>
          </div>
        </div>
        <Button>
          <Upload className="mr-2 h-4 w-4" />
          Upload Transactions
        </Button>
      </div>

      <TransactionsTable />
    </div>
  );
}
