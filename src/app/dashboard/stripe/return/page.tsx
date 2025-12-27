
'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function StripeReturnPage() {
    const { toast } = useToast();

    useEffect(() => {
        toast({
            title: "Onboarding Complete!",
            description: "Your account details have been saved with Stripe. You can now receive payments.",
            variant: "default",
        });
    }, [toast]);

    return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <Card className="w-full max-w-lg text-center shadow-lg">
                <CardHeader>
                    <div className="mx-auto bg-green-100 p-3 rounded-full w-fit">
                         <CheckCircle2 className="h-10 w-10 text-green-600" />
                    </div>
                    <CardTitle className="mt-4 text-2xl">Setup Complete!</CardTitle>
                    <CardDescription>
                        Your account is now connected to Stripe. You can now send invoices and receive payments directly to your bank account.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Link href="/dashboard/settings">
                        <Button>Return to Settings</Button>
                    </Link>
                </CardContent>
            </Card>
        </div>
    );
}
