
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { recordManualPayment } from '@/actions/record-payment';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Wallet } from 'lucide-react';

export function RecordPaymentModal({
  tenant,
  propertyId,
  unitId,
  landlordId,
  onSuccess,
}: {
  tenant: any;
  propertyId: string;
  unitId?: string;
  landlordId: string;
  onSuccess?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [amount, setAmount] = useState(tenant.rentAmount || '');
  const [method, setMethod] = useState('Zelle');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleRecord = async () => {
    setLoading(true);
    try {
      await recordManualPayment({
        tenantId: tenant.id,
        propertyId,
        unitId,
        landlordId,
        amount: Number(amount),
        method,
        date: new Date().toISOString(),
      });
      toast({
        title: 'Payment Recorded',
        description: 'Ledger and tenant balance updated.',
      });
      setIsOpen(false);
      if (onSuccess) onSuccess();
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: e.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm" className="h-7 bg-green-600 hover:bg-green-700 text-white">
          Record Payment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Payment for {tenant.firstName}</DialogTitle>
          <DialogDescription>
            Log a manual payment received via cash, check, or other methods.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Amount Received</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Select onValueChange={setMethod} defaultValue="Zelle">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Zelle">Zelle</SelectItem>
                <SelectItem value="Cash">Cash</SelectItem>
                <SelectItem value="Check">Check</SelectItem>
                <SelectItem value="Venmo">Venmo</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button
            onClick={handleRecord}
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Confirm & Update Ledger'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
