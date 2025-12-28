
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { createTenantInvoice } from '@/actions/stripe-actions';
import { Loader2, FileText } from 'lucide-react';

interface CreateChargeDialogProps {
  landlordAccountId?: string;
  tenantEmail?: string;
  tenantPhone?: string;
  rentAmount?: number;
}

export function CreateChargeDialog({ landlordAccountId, tenantEmail, tenantPhone, rentAmount }: CreateChargeDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    tenantEmail: '',
    tenantPhone: '',
    amount: '',
    description: '',
  });

  useEffect(() => {
    if (isOpen) {
      setFormData({
        tenantEmail: tenantEmail || '',
        tenantPhone: tenantPhone || '',
        amount: rentAmount ? String(rentAmount) : '',
        description: rentAmount ? 'Monthly Rent' : '',
      });
    }
  }, [isOpen, tenantEmail, tenantPhone, rentAmount]);
  

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (!landlordAccountId) {
        toast({
            variant: 'destructive',
            title: 'Stripe Account Not Connected',
            description: 'The landlord has not connected a Stripe account for payouts.',
        });
        return;
    }
    setIsLoading(true);
    try {
      const result = await createTenantInvoice({
        landlordAccountId,
        tenantEmail: formData.tenantEmail,
        tenantPhone: formData.tenantPhone,
        amount: Number(formData.amount),
        description: formData.description,
      });

      if (result.success) {
        toast({
          title: 'Invoice Sent!',
          description: 'The tenant has been notified. You can view the invoice externally.',
          action: (
            <a href={result.invoiceUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline">View Invoice</Button>
            </a>
          ),
        });
        setIsOpen(false);
        // Form is reset by useEffect on next open
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to Send Invoice',
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="w-full bg-blue-600 hover:bg-blue-700">
            Create Charge
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="text-blue-600" />
            Create a New Charge
          </DialogTitle>
          <DialogDescription>
            This will send a payable invoice to the tenant for one-off charges like repairs or late fees.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="tenantEmail">Tenant Email</Label>
            <Input
              id="tenantEmail"
              name="tenantEmail"
              type="email"
              placeholder="tenant@example.com"
              value={formData.tenantEmail}
              onChange={handleChange}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tenantPhone">Tenant Phone (for SMS)</Label>
            <Input
              id="tenantPhone"
              name="tenantPhone"
              type="tel"
              placeholder="+15551234567"
              value={formData.tenantPhone}
              onChange={handleChange}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="amount">Amount ($)</Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              placeholder="e.g., 50.00"
              value={formData.amount}
              onChange={handleChange}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="e.g., 'Repair for broken window' or 'Late Fee for January Rent'"
              value={formData.description}
              onChange={handleChange}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isLoading || !landlordAccountId}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send Invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
