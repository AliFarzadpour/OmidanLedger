'use client';

import { useState, useEffect } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { Button } from '@/components/ui/button';
import { createLinkToken } from '@/lib/plaid';
import { useUser } from '@/firebase';
import { PlaidLinkOnSuccess } from 'react-plaid-link';
import { useToast } from '@/hooks/use-toast';

interface PlaidLinkProps {
  onSuccess: PlaidLinkOnSuccess;
  daysRequested: number;
}

export function PlaidLink({ onSuccess, daysRequested }: PlaidLinkProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function generateToken() {
      if (user) {
        try {
          const token = await createLinkToken({ userId: user.uid, daysRequested });
          setLinkToken(token);
          setError(null);
        } catch (e: any) {
          console.error('Error creating link token:', e.message);
          setError(e.message || 'Could not create Plaid link token.');
          toast({
            variant: 'destructive',
            title: 'Plaid Setup Incomplete',
            description: e.message || 'Could not create Plaid link token. Please check your .env file.',
          });
        }
      }
    }
    if (daysRequested > 0) {
        generateToken();
    }
  }, [user, toast, daysRequested]);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
  });

  const handleClick = () => {
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Plaid Setup Incomplete',
        description: error,
      });
      return;
    }
    if (ready && linkToken) {
      open();
    }
  };

  return (
    <Button onClick={handleClick} disabled={!ready} className="w-full">
      Connect with Plaid
    </Button>
  );
}
