'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { Button } from '@/components/ui/button';
import { createLinkToken } from '@/ai/flows/plaid-flows';
import { useUser } from '@/firebase';
import { PlaidLinkOptions, PlaidLinkOnExit, PlaidLinkOnSuccess } from 'react-plaid-link';

interface PlaidLinkProps {
  onSuccess: PlaidLinkOnSuccess;
  onOpenChange: (open: boolean) => void;
}

export function PlaidLink({ onSuccess, onOpenChange }: PlaidLinkProps) {
  const { user } = useUser();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [shouldOpen, setShouldOpen] = useState(false);

  useEffect(() => {
    async function generateToken() {
      if (user) {
        try {
          const token = await createLinkToken({ userId: user.uid });
          setLinkToken(token);
        } catch (error) {
          console.error('Error creating link token:', error);
        }
      }
    }
    generateToken();
  }, [user]);

  const onExit = useCallback<PlaidLinkOnExit>(
    (error, metadata) => {
      onOpenChange(false);
      console.log('Plaid Link exited:', error, metadata);
    },
    [onOpenChange]
  );
  
  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
    onExit,
  });

  useEffect(() => {
    if (shouldOpen && ready) {
      // Use a timeout to ensure the dialog has had time to close and unmount
      setTimeout(() => open(), 0);
      setShouldOpen(false); // Reset the trigger
    }
  }, [shouldOpen, ready, open]);

  const handleOpenPlaid = () => {
    onOpenChange(false); // Close the dialog first
    setShouldOpen(true);  // Set state to trigger opening Plaid Link in useEffect
  };

  return (
    <Button onClick={handleOpenPlaid} disabled={!ready || !linkToken} className="w-full">
      Connect with Plaid
    </Button>
  );
}
