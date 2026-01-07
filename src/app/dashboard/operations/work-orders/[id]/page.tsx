
'use client';

import { WorkOrderForm } from '@/components/operations/WorkOrderForm';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function EditWorkOrderPage() {
    const router = useRouter();
    const { id } = useParams();
    const { user } = useUser();
    const firestore = useFirestore();

    const workOrderRef = useMemoFirebase(() => {
        if (!user || !firestore || !id) return null;
        return doc(firestore, `users/${user.uid}/opsWorkOrders`, id as string);
    }, [user, firestore, id]);

    const { data: workOrder, isLoading } = useDoc(workOrderRef);

    if (isLoading) {
        return <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin"/></div>
    }

    if (!workOrder) {
        return <div className="p-8 text-center">Work order not found.</div>
    }

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Edit Work Order</h1>
                    <p className="text-muted-foreground">Update details for: {workOrder.title}</p>
                </div>
            </div>
            <WorkOrderForm initialData={workOrder} />
        </div>
    );
}

    