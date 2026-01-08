'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { inviteTenant } from '@/actions/tenant-actions';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Loader2, UserPlus } from 'lucide-react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

interface InviteTenantModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  landlordId: string;
  propertyId: string;
  unitId?: string;
}

export default function InviteTenantModal({ isOpen, onOpenChange, landlordId, propertyId, unitId }: InviteTenantModalProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user: landlordUser } = useUser();
  const firestore = useFirestore();

  const propertyDocRef = useMemoFirebase(() => {
    if (!firestore || !propertyId) return null;
    return doc(firestore, 'properties', propertyId);
  }, [firestore, propertyId]);
  
  const { data: propertyData } = useDoc(propertyDocRef);

  const handleInvite = async () => {
    if (!propertyId || !email) {
      toast({ variant: "destructive", title: "Error", description: "Email and property are required." });
      return;
    }
    setLoading(true);

    try {
      // Store the email in localStorage BEFORE calling the server action.
      // This is crucial for the magic link to work smoothly on the same device.
      window.localStorage.setItem('tenantInviteEmail', email);

      const result = await inviteTenant({
        email,
        propertyId,
        unitId,
        landlordId,
        landlordName: landlordUser?.displayName || landlordUser?.email || 'Your Landlord',
        propertyName: propertyData?.name || 'your property',
      });
      
      toast({ 
        title: "Invitation Sent!", 
        description: result.message
      });

      setEmail('');
      onOpenChange(false);

    } catch (e: any) {
      console.error("Invitation process failed:", e);
      toast({ variant: "destructive", title: "Invitation Failed", description: e.message });
      // Clear storage if the server action fails
      window.localStorage.removeItem('tenantInviteEmail');
    } finally {
      setLoading(false);
    }
  };
  
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setEmail('');
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserPlus /> Create Tenant Portal</DialogTitle>
          <DialogDescription>
            This will create a user account and send a magic login link to the tenant's email.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Tenant Email</Label>
            <Input id="email" placeholder="tenant@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleInvite} disabled={loading || !email} className="min-w-[120px]">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create & Send Invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}