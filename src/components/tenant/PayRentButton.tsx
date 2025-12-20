'use client';

import { useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { Button } from '@/components/ui/button';
import { CreditCard, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function PayRentButton({ amount, tenantId }: { amount: number, tenantId: string }) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // 1. Get a Link Token specifically for a Transfer
  const getLinkToken = async () => {
    setLoading(true);
    const response = await fetch('/api/plaid/create-transfer-link-token', { method: 'POST' });
    const data = await response.json();
    setLinkToken(data.link_token);
    setLoading(false);
  };

  const { open, ready } = usePlaidLink({
    token: linkToken!,
    onSuccess: async (public_token, metadata) => {
      // 2. Exchange token and trigger the payment
      const res = await fetch('/api/plaid/execute-rent-payment', {
        method: 'POST',
        body: JSON.stringify({ public_token, amount, tenantId, accountId: metadata.account_id })
      });
      if (res.ok) toast({ title: "Payment Initiated", description: "Your rent is being processed." });
    },
  });

  return (
    <Button 
      onClick={() => linkToken ? open() : getLinkToken()} 
      disabled={loading || (linkToken && !ready)}
      className="w-full bg-blue-600 hover:bg-blue-700 h-16 text-lg gap-3"
    >
      {loading ? <Loader2 className="animate-spin" /> : <CreditCard />}
      Pay ${amount.toLocaleString()} Now
    </Button>
  );
}
