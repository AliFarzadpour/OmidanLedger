
'use client';

import { useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { Wrench, User, Building, Calendar, DollarSign, ListChecks, Receipt } from 'lucide-react';
import { updateWorkOrderStatus } from '@/actions/work-order-actions';
import { useToast } from '@/hooks/use-toast';
import { CreateExpenseFromWorkOrderDialog } from './CreateExpenseFromWorkOrderDialog';
import Link from 'next/link';
import { formatCurrency } from '@/lib/format';

function StatCard({ title, value, icon, action }: { title: string, value: React.ReactNode, icon: React.ReactNode, action?: React.ReactNode }) {
    return (
        <Card className="shadow-sm">
            <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-sm text-muted-foreground">{title}</p>
                        <div className="text-2xl font-bold">{value || 'N/A'}</div>
                    </div>
                    <div className="p-2 bg-muted rounded-md text-muted-foreground">{icon}</div>
                </div>
            </CardHeader>
            {action && <CardContent>{action}</CardContent>}
        </Card>
    )
}

export function WorkOrderDetailOverview({ workOrder, onUpdate }: { workOrder: any, onUpdate: () => void }) {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    const { data: properties, isLoading: isLoadingProperties } = useCollection(
        useMemoFirebase(() => user ? query(collection(firestore, 'properties'), where('userId', '==', user.uid)) : null, [user, firestore])
    );
    const { data: vendors, isLoading: isLoadingVendors } = useCollection(
        useMemoFirebase(() => user ? query(collection(firestore, 'vendors'), where('userId', '==', user.uid)) : null, [user, firestore])
    );

    const propertyName = properties?.find(p => p.id === workOrder.propertyId)?.name || workOrder.propertyId;
    const vendorName = vendors?.find(v => v.id === workOrder.vendorId)?.name || 'Unassigned';

    const handleStatusChange = async (status: string) => {
        if (!user) return;
        try {
            await updateWorkOrderStatus(user.uid, workOrder.id, status);
            toast({ title: 'Status Updated', description: `Work order marked as ${status}.` });
            onUpdate();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Overview</CardTitle>
                        <CardDescription>Key details about this work order.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-6">
                        <StatCard title="Property" value={propertyName} icon={<Building />} />
                        <StatCard title="Assigned Vendor" value={vendorName} icon={<Wrench />} />
                        <StatCard title="Status" value={
                            <Select defaultValue={workOrder.status} onValueChange={handleStatusChange}>
                                <SelectTrigger className="text-2xl font-bold h-auto border-0 p-0 shadow-none focus:ring-0">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="New">New</SelectItem>
                                    <SelectItem value="Scheduled">Scheduled</SelectItem>
                                    <SelectItem value="In Progress">In Progress</SelectItem>
                                    <SelectItem value="Waiting">Waiting</SelectItem>
                                    <SelectItem value="Completed">Completed</SelectItem>
                                    <SelectItem value="Canceled">Canceled</SelectItem>
                                </SelectContent>
                            </Select>
                        } icon={<ListChecks />} />
                         <StatCard title="Priority" value={workOrder.priority} icon={<ListChecks />} />
                        <StatCard title="Scheduled" value={workOrder.scheduledAt ? format(workOrder.scheduledAt.toDate(), 'PPP') : 'Not Set'} icon={<Calendar />} />
                        <StatCard title="Due Date" value={workOrder.dueDate ? format(workOrder.dueDate.toDate(), 'PPP') : 'Not Set'} icon={<Calendar />} />
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader><CardTitle>Description</CardTitle></CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">{workOrder.description || 'No description provided.'}</p>
                    </CardContent>
                 </Card>
            </div>
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Costs & Accounting</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                       <StatCard title="Estimated Cost" value={`${formatCurrency(workOrder.estimatedCost || 0)}`} icon={<DollarSign />} />
                       <StatCard title="Actual Cost" value={`${formatCurrency(workOrder.actualCost || 0)}`} icon={<DollarSign />} />
                        {workOrder.accounting?.expenseTransactionId ? (
                            <Button variant="outline" asChild className="w-full">
                                <Link href="/dashboard/transactions">View Linked Expense</Link>
                            </Button>
                        ) : (
                            <CreateExpenseFromWorkOrderDialog workOrder={workOrder} onUpdate={onUpdate} />
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
