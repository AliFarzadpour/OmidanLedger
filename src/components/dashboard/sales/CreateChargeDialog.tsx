'use client';

import { useState } from 'react';
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

export function CreateChargeDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    landlordAccountId: 'acct_1PgB1k2eZvKYlo2C', // Replace with dynamic ID
    tenantEmail: '',
    amount: '',
    description: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const result = await createTenantInvoice({
        ...formData,
        amount: Number(formData.amount),
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
        setFormData({ landlordAccountId: 'acct_1PgB1k2eZvKYlo2C', tenantEmail: '', amount: '', description: '' });
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
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send Invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
