'use client';

import { useState, useEffect } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { Button } from '@/components/ui/button';
import { CreditCard, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function PayRentButton({ amount, tenantId }: { amount: number, tenantId: string }) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const getLinkToken = async () => {
    setIsLoading(true);
    try {
        const response = await fetch('/api/plaid/create-transfer-link-token', { 
            method: 'POST',
            body: JSON.stringify({ tenantId }), // Pass tenantId if needed by your backend
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to create link token.');
        }
        const data = await response.json();
        setLinkToken(data.link_token);
    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: 'Payment Setup Failed',
            description: error.message
        });
        setIsLoading(false);
    }
  };
  
  useEffect(() => {
    // Automatically open Plaid if the token is ready
    if (linkToken) {
        open();
        setIsLoading(false);
    }
  }, [linkToken]);


  const { open, ready } = usePlaidLink({
    token: linkToken!,
    onSuccess: async (public_token, metadata) => {
        toast({ title: "Connecting to Bank...", description: "Authorizing your payment." });
        try {
            const res = await fetch('/api/plaid/execute-rent-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    public_token, 
                    amount, 
                    tenantId, 
                    accountId: metadata.accounts[0].id 
                })
            });

            if (!res.ok) {
                 const errorData = await res.json();
                 throw new Error(errorData.error || 'Payment failed.');
            }

            toast({ 
                title: "Payment Initiated!", 
                description: "Your rent payment is processing and will reflect soon." 
            });

        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Payment Failed',
                description: error.message
            });
        }
    },
    onExit: (err, metadata) => {
        if (err) {
            console.error('Plaid Link exit error:', err);
        }
        setLinkToken(null); // Reset token on exit
    }
  });

  return (
    <Button 
      onClick={getLinkToken} 
      disabled={isLoading || (!!linkToken && !ready)}
      className="w-full bg-blue-600 hover:bg-blue-700 h-16 text-lg gap-3"
    >
      {isLoading ? <Loader2 className="animate-spin" /> : <CreditCard />}
      Pay ${amount.toLocaleString()} Now
    </Button>
  );
}
