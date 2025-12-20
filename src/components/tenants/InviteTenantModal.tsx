'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { inviteTenant } from '@/actions/tenant-actions';
import { useToast } from '@/hooks/use-toast';

export function InviteTenantModal({ propertyId, landlordId }: { propertyId: string, landlordId: string }) {
  const [email, setEmail] = useState('');
  const [rent, setRent] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleInvite = async () => {
    setLoading(true);
    try {
      await inviteTenant({ email, propertyId, landlordId, rentAmount: Number(rent) });
      toast({ title: "Invite Sent", description: `Tenant ${email} has been added.` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4 border rounded-lg bg-white shadow-sm">
      <h3 className="font-bold">Invite New Tenant</h3>
      <Input placeholder="Tenant Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Input placeholder="Monthly Rent Amount" type="number" value={rent} onChange={(e) => setRent(e.target.value)} />
      <Button onClick={handleInvite} disabled={loading} className="w-full">
        {loading ? "Sending..." : "Create Tenant Account"}
      </Button>
    </div>
  );
}
