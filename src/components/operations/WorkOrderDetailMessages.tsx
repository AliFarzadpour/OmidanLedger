
'use client';

import { useState } from 'react';
import { useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Paperclip, Send, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { addMessageToWorkOrder } from '@/actions/work-order-actions';
import { format } from 'date-fns';

export function WorkOrderDetailMessages({ workOrder, messages, onUpdate }: { workOrder: any, messages: any[], onUpdate: () => void }) {
    const { user } = useUser();
    const [newMessage, setNewMessage] = useState('');
    const [visibility, setVisibility] = useState<'internal' | 'shared'>('internal');
    const [isSending, setIsSending] = useState(false);
    const { toast } = useToast();

    const handleSendMessage = async () => {
        if (!user || !newMessage.trim()) return;
        setIsSending(true);
        try {
            await addMessageToWorkOrder(user.uid, workOrder.id, {
                body: newMessage,
                visibility,
                author: { type: 'landlord', id: user.uid, name: user.displayName || user.email || 'Landlord' }
            });
            setNewMessage('');
            onUpdate();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setIsSending(false);
        }
    };

    return (
        <Card>
            <CardContent className="pt-6 space-y-6">
                <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-4">
                    {messages.map(msg => (
                        <div key={msg.id} className="flex gap-3">
                            <Avatar>
                                <AvatarFallback>{msg.author.name?.charAt(0) || 'U'}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                                <div className="flex items-center justify-between">
                                    <span className="font-semibold text-sm">{msg.author.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                        {msg.createdAt ? format(msg.createdAt.toDate(), 'PPpp') : '...'}
                                    </span>
                                </div>
                                <div className="p-3 bg-slate-100 rounded-md mt-1 text-sm">{msg.body}</div>
                            </div>
                        </div>
                    ))}
                </div>
                 <div className="border-t pt-4 space-y-3">
                    <Textarea 
                        placeholder="Type your message or internal note..." 
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        className="min-h-[100px]"
                    />
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                             <Select value={visibility} onValueChange={(v: any) => setVisibility(v)}>
                                <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="internal">Internal Note</SelectItem>
                                    <SelectItem value="shared">Shared Message</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button variant="ghost" size="icon"><Paperclip className="h-4 w-4" /></Button>
                        </div>
                        <Button onClick={handleSendMessage} disabled={isSending}>
                            {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4" />}
                            Send
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
