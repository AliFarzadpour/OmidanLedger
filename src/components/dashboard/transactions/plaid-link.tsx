'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { Button } from '@/components/ui/button';
import { createLinkToken } from '@/ai/flows/plaid-flows';
import { useUser } from '@/firebase';
import { PlaidLinkOptions, PlaidLinkOnExit, PlaidLinkOnSuccess } from 'react-plaid-link';

interface PlaidLinkProps {
  onSuccess: PlaidLinkOnSuccess;
}

export function PlaidLink({ onSuccess }: PlaidLinkProps) {
  const { user } = useUser();
  const [linkToken, setLinkToken] = useState<string | null>(null);

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
  
  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
  });

  return (
    <Button onClick={() => open()} disabled={!ready || !linkToken} className="w-full">
      Connect with Plaid
    </Button>
  );
}
