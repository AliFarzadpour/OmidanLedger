'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { inviteTenant } from '@/actions/tenant-actions';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Loader2, UserPlus } from 'lucide-react';
import { useAuth } from '@/firebase'; // Import the client-side auth hook
import { sendSignInLinkToEmail } from 'firebase/auth'; // Import the email sending function

interface InviteTenantModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  landlordId: string;
  propertyId: string;
  unitId?: string;
}

export function InviteTenantModal({ isOpen, onOpenChange, landlordId, propertyId, unitId }: InviteTenantModalProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const auth = useAuth(); // Get the client-side auth instance

  const handleInvite = async () => {
    if (!propertyId) {
      toast({ variant: "destructive", title: "Error", description: "A property ID is required to invite a tenant." });
      return;
    }
    setLoading(true);

    try {
      // Step 1: Create the user on the server.
      const userCreationResult = await inviteTenant({ email, propertyId, unitId, landlordId });

      if (!userCreationResult.success) {
        throw new Error(userCreationResult.message);
      }
      
      toast({ title: "Account Created", description: userCreationResult.message });

      // Step 2: On success, trigger the email from the client using a dynamic URL.
      const baseUrl = window.location.origin;
      
      const actionCodeSettings = {
        url: `${baseUrl}/tenant/accept`,
        handleCodeInApp: true,
      };

      await sendSignInLinkToEmail(auth, email, actionCodeSettings);

      // Store the email temporarily in local storage to be retrieved on the accept page.
      window.localStorage.setItem('emailForSignIn', email);

      toast({ 
        title: "Invitation Sent!", 
        description: `An invitation email has been sent to ${email}.`
      });

      setEmail('');
      onOpenChange(false);

    } catch (e: any) {
      toast({ variant: "destructive", title: "Invitation Failed", description: e.message });
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
