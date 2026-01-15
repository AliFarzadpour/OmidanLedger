'use client';

import TenantPaymentHistory from '@/components/tenant/TenantPaymentHistory';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collectionGroup, query, where } from 'firebase/firestore';

export default function TenantHistoryPage() {
    const { user } = useUser();
    const firestore = useFirestore();

    const transactionsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(collectionGroup(firestore, 'transactions'), where('tenantId', '==', user.uid));
    }, [user, firestore]);

    const { data: transactions, isLoading: isLoadingTransactions } = useCollection(transactionsQuery);
    
    return (
        <div className="space-y-6">
            <TenantPaymentHistory transactions={transactions || []} isLoading={isLoadingTransactions} />
        </div>
    );
}
