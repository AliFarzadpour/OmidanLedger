'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { inviteTenant } from '@/actions/tenant-actions';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Loader2, UserPlus } from 'lucide-react';

interface InviteTenantModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  landlordId: string;
  propertyId: string;
  unitId?: string; // Optional unit ID
}

export function InviteTenantModal({ isOpen, onOpenChange, landlordId, propertyId, unitId }: InviteTenantModalProps) {
  const [email, setEmail] = useState('');
  const [rent, setRent] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleInvite = async () => {
    if (!propertyId) {
      toast({ variant: "destructive", title: "Error", description: "A property ID is required to invite a tenant." });
      return;
    }
    setLoading(true);
    try {
      await inviteTenant({ email, propertyId, unitId, landlordId, rentAmount: Number(rent) });
      toast({ title: "Invite Sent", description: `Tenant ${email} has been added.` });
      setEmail('');
      setRent('');
      onOpenChange(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setLoading(false);
    }
  };
  
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setEmail('');
      setRent('');
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserPlus /> Invite New Tenant</DialogTitle>
          <DialogDescription>
            Create a tenant account and link them to this property. They will be invited to set up their portal.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Tenant Email</Label>
            <Input id="email" placeholder="tenant@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="rent">Monthly Rent Amount</Label>
            <Input id="rent" placeholder="1500" type="number" value={rent} onChange={(e) => setRent(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleInvite} disabled={loading} className="min-w-[120px]">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
