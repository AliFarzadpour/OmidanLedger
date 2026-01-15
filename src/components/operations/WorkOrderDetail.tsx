
'use client';

import { useState } from 'react';
import { useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Edit } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { WorkOrderForm } from './WorkOrderForm';
import { WorkOrderDetailOverview } from './WorkOrderDetailOverview';
import { WorkOrderDetailMessages } from './WorkOrderDetailMessages';
import { WorkOrderDetailTasks } from './WorkOrderDetailTasks';

export function WorkOrderDetail({ workOrder, messages, tasks, onUpdate }: { workOrder: any, messages: any[], tasks: any[], onUpdate: () => void }) {
    const router = useRouter();
    const { user } = useUser();
    const [isEditOpen, setIsEditOpen] = useState(false);

    if (!user) return null;
    
    const unreadMessages = messages.filter(m => !m.isRead && m.author.id !== user.uid).length;

    return (
        <>
            <div className="space-y-6 p-8">
                <header className="flex justify-between items-start">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/operations/work-orders')}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">{workOrder.title}</h1>
                            <p className="text-muted-foreground">Manage details, communication, and tasks for this work order.</p>
                        </div>
                    </div>
                     <Button variant="outline" onClick={() => setIsEditOpen(true)}>
                        <Edit className="mr-2 h-4 w-4" /> Edit Work Order
                    </Button>
                </header>

                <Tabs defaultValue="overview">
                    <TabsList>
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="messages">
                            Messages {unreadMessages > 0 && <span className="ml-2 bg-blue-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full">{unreadMessages}</span>}
                        </TabsTrigger>
                        <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
                    </TabsList>
                    <TabsContent value="overview" className="mt-6">
                        <WorkOrderDetailOverview workOrder={workOrder} onUpdate={onUpdate}/>
                    </TabsContent>
                    <TabsContent value="messages" className="mt-6">
                        <WorkOrderDetailMessages workOrder={workOrder} messages={messages} onUpdate={onUpdate} />
                    </TabsContent>
                    <TabsContent value="tasks" className="mt-6">
                        <WorkOrderDetailTasks workOrder={workOrder} tasks={tasks} onUpdate={onUpdate}/>
                    </TabsContent>
                </Tabs>
            </div>
             <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Work Order</DialogTitle>
                        <DialogDescription>
                            Make changes to the work order details.
                        </DialogDescription>
                    </DialogHeader>
                    <WorkOrderForm 
                        initialData={workOrder} 
                        onSuccess={() => { onUpdate(); setIsEditOpen(false); }} 
                    />
                </DialogContent>
            </Dialog>
        </>
    )
}
