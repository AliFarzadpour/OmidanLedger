
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { inviteTenant } from '@/actions/tenant-actions';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Loader2, UserPlus } from 'lucide-react';
import { useAuth } from '@/firebase';
import { sendSignInLinkToEmail } from 'firebase/auth';

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
    if (!propertyId || !email) {
      toast({ variant: "destructive", title: "Error", description: "Email and property are required." });
      return;
    }
    setLoading(true);

    try {
      // Step 1: Create the user on the server.
      await inviteTenant({ email, propertyId, unitId, landlordId });

      // Step 2: If server-side creation is successful, send the email from the client.
      const actionCodeSettings = {
        // This URL must be absolute and must be in your authorized domains in Firebase Console.
        url: `${window.location.origin}/tenant/accept`,
        handleCodeInApp: true,
      };

      // Store the email in localStorage so the /accept page can retrieve it.
      window.localStorage.setItem('tenantInviteEmail', email);

      // Trigger Firebase's built-in email sending.
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      
      toast({ 
        title: "Invitation Sent!", 
        description: `A secure sign-in link has been sent to ${email}.`
      });

      setEmail('');
      onOpenChange(false);

    } catch (e: any) {
      console.error("Invitation process failed:", e);
      // If any step fails, inform the user.
      toast({ variant: "destructive", title: "Invitation Failed", description: e.message });
      // Clear local storage on failure to prevent issues.
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
