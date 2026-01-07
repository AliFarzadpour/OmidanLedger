
'use client';

import { WorkOrderForm } from '@/components/operations/WorkOrderForm';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function NewWorkOrderPage() {
    const router = useRouter();

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">New Work Order</h1>
                    <p className="text-muted-foreground">Create a new maintenance or repair task.</p>
                </div>
            </div>
            <WorkOrderForm />
        </div>
    );
}

    