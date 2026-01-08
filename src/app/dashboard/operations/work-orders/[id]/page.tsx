
'use client';

import { WorkOrderDetail } from '@/components/operations/WorkOrderDetail';
import { useParams } from 'next/navigation';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

export default function WorkOrderDetailPage() {
    const { id } = useParams();
    const { user } = useUser();
    const firestore = useFirestore();

    const workOrderRef = useMemoFirebase(() => {
        if (!user || !firestore || !id) return null;
        return doc(firestore, `users/${user.uid}/opsWorkOrders`, id as string);
    }, [user, firestore, id]);
    
    const messagesQuery = useMemoFirebase(() => workOrderRef ? query(collection(workOrderRef, 'messages'), orderBy('createdAt', 'asc')) : null, [workOrderRef]);
    const tasksQuery = useMemoFirebase(() => workOrderRef ? query(collection(workOrderRef, 'tasks'), orderBy('createdAt', 'asc')) : null, [workOrderRef]);

    const { data: workOrder, isLoading: isLoadingWO, refetch: refetchWO } = useDoc(workOrderRef);
    const { data: messages, isLoading: isLoadingMessages, refetch: refetchMessages } = useCollection(messagesQuery);
    const { data: tasks, isLoading: isLoadingTasks, refetch: refetchTasks } = useCollection(tasksQuery);

    const onDataChange = () => {
        refetchWO();
        refetchMessages();
        refetchTasks();
    }
    
    const isLoading = isLoadingWO || isLoadingMessages || isLoadingTasks;

    if (isLoading) {
        return <div className="flex h-full w-full items-center justify-center p-20"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>
    }

    if (!workOrder) {
        return <div className="p-8 text-center text-lg font-semibold">Work order not found.</div>
    }

    return (
        <WorkOrderDetail 
            workOrder={workOrder} 
            messages={messages || []}
            tasks={tasks || []}
            onUpdate={onDataChange}
        />
    );
}

