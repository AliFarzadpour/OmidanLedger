'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collectionGroup, query, where, getDocs, startOfMonth, endOfMonth, format } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Pencil } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/format';
import { updateTransactionAssignment } from '@/actions/accounting-actions'; 

export function AssignPaymentDialog({ tenant, viewingDate, onSuccess }: { tenant: any, viewingDate: Date, onSuccess: () => void }) {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [selectedTxId, setSelectedTxId] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen || !user || !firestore) return;

        const fetchUnassignedIncome = async () => {
            setIsLoading(true);
            try {
                const monthStart = format(startOfMonth(viewingDate), 'yyyy-MM-dd');
                const monthEnd = format(endOfMonth(viewingDate), 'yyyy-MM-dd');
                
                const q = query(
                    collectionGroup(firestore, 'transactions'),
                    where('userId', '==', user.uid),
                    where('date', '>=', monthStart),
                    where('date', '<=', monthEnd),
                    where('categoryHierarchy.l0', '==', 'INCOME')
                );

                const snap = await getDocs(q);
                const txs = snap.docs.map(d => ({
                    id: d.id,
                    bankAccountId: d.ref.parent.parent?.id,
                    ...d.data()
                })).filter(tx => !tx.costCenter); // Client-side filter for unassigned
                
                setTransactions(txs);
            } catch (error: any) {
                toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch unassigned payments.' });
            } finally {
                setIsLoading(false);
            }
        };

        fetchUnassignedIncome();
    }, [isOpen, user, firestore, viewingDate, toast]);

    const handleSave = async () => {
        if (!user || !selectedTxId) return;

        const transactionToAssign = transactions.find(tx => tx.id === selectedTxId);
        if (!transactionToAssign) return;

        setIsSaving(true);
        try {
            await updateTransactionAssignment({
                userId: user.uid,
                transactionId: selectedTxId,
                bankAccountId: transactionToAssign.bankAccountId,
                costCenter: tenant.unitId || tenant.propertyId,
                tenantId: tenant.tenantId
            });
            toast({ title: 'Payment Assigned', description: 'The rent roll has been updated.' });
            onSuccess();
            setIsOpen(false);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-blue-600">
                    <Pencil className="h-3 w-3" />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Assign Payment for {tenant.tenantName}</DialogTitle>
                    <DialogDescription>
                        Select an unassigned income transaction from this month to link it to this tenant's rent payment.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 max-h-[50vh] overflow-y-auto">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-24"><Loader2 className="animate-spin" /></div>
                    ) : transactions.length === 0 ? (
                        <p className="text-center text-sm text-muted-foreground">No unassigned income transactions found for this period.</p>
                    ) : (
                        <RadioGroup onValueChange={setSelectedTxId}>
                            <div className="space-y-2">
                                {transactions.map(tx => (
                                    <Label key={tx.id} htmlFor={tx.id} className="flex items-center gap-4 border p-3 rounded-md hover:bg-muted has-[input:checked]:bg-blue-50 has-[input:checked]:border-blue-200">
                                        <RadioGroupItem value={tx.id} id={tx.id} />
                                        <div className="flex-1">
                                            <p className="font-medium">{tx.description}</p>
                                            <p className="text-xs text-muted-foreground">{tx.date}</p>
                                        </div>
                                        <p className="font-mono font-semibold">{formatCurrency(tx.amount)}</p>
                                    </Label>
                                ))}
                            </div>
                        </RadioGroup>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={isSaving || !selectedTxId}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Assign Payment
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
