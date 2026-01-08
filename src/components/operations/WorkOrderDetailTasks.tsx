
'use client';

import { useState } from 'react';
import { useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { addTaskToWorkOrder, toggleWorkOrderTask } from '@/actions/work-order-actions';

export function WorkOrderDetailTasks({ workOrder, tasks, onUpdate }: { workOrder: any, tasks: any[], onUpdate: () => void }) {
    const { user } = useUser();
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const { toast } = useToast();

    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !newTaskTitle.trim()) return;
        setIsAdding(true);
        try {
            await addTaskToWorkOrder(user.uid, workOrder.id, newTaskTitle);
            setNewTaskTitle('');
            onUpdate();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setIsAdding(false);
        }
    };

    const handleToggleTask = async (taskId: string, isDone: boolean) => {
        if (!user) return;
        try {
            await toggleWorkOrderTask(user.uid, workOrder.id, taskId, isDone);
            onUpdate();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not update task status.' });
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Checklist</CardTitle>
                <CardDescription>Break down the work order into smaller, trackable tasks.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {tasks.map(task => (
                        <div key={task.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-slate-50">
                            <Checkbox 
                                id={`task-${task.id}`}
                                checked={task.isDone}
                                onCheckedChange={(checked) => handleToggleTask(task.id, !!checked)}
                            />
                            <label htmlFor={`task-${task.id}`} className={`flex-1 text-sm ${task.isDone ? 'line-through text-muted-foreground' : ''}`}>
                                {task.title}
                            </label>
                        </div>
                    ))}
                     {tasks.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">No tasks added yet.</p>}
                </div>

                <form onSubmit={handleAddTask} className="flex gap-2 mt-4 border-t pt-4">
                    <Input 
                        placeholder="Add a new task..."
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                    />
                    <Button type="submit" disabled={isAdding}>
                        {isAdding ? <Loader2 className="h-4 w-4 animate-spin"/> : <Plus className="h-4 w-4" />}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
