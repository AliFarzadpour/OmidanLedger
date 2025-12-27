'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CheckCircle2, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { useUser } from '@/firebase';
import { checkStripeAccountStatus } from '@/actions/stripe-connect-actions';

function StatusCard({ status, message, children }: { status: 'loading' | 'success' | 'error' | 'idle', message: string, children?: React.ReactNode }) {
    const icons = {
        idle: <RefreshCw className="h-10 w-10 text-primary" />,
        loading: <Loader2 className="h-10 w-10 text-primary animate-spin" />,
        success: <CheckCircle2 className="h-10 w-10 text-green-600" />,
        error: <AlertCircle className="h-10 w-10 text-destructive" />,
    };
    const colors = {
        idle: "bg-primary/10",
        loading: "bg-primary/10",
        success: "bg-green-100",
        error: "bg-destructive/10",
    }

    return (
        <Card className="w-full max-w-lg text-center shadow-lg">
            <CardHeader>
                <div className={`mx-auto p-3 rounded-full w-fit ${colors[status]}`}>
                    {icons[status]}
                </div>
                <CardTitle className="mt-4 text-2xl">
                    {status === 'idle' && 'Ready to Verify'}
                    {status === 'loading' && 'Verifying Your Account...'}
                    {status === 'success' && 'Setup Complete!'}
                    {status === 'error' && 'Verification Failed'}
                </CardTitle>
                <CardDescription>
                    {message}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {children}
            </CardContent>
        </Card>
    );
}


export default function StripeReturnPage() {
    const { user } = useUser();
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('Click the button below to confirm your Stripe account status.');
    const [isPending, startTransition] = useTransition();

    const handleVerify = () => {
        if (user?.uid) {
            setStatus('loading');
            setMessage('Please wait while we confirm your Stripe account status. Do not close this page.');
            startTransition(async () => {
                try {
                    const result = await checkStripeAccountStatus(user.uid);
                    if (result.isReady) {
                        setStatus('success');
                        setMessage('Your account is connected and ready to receive payments.');
                    } else {
                        setStatus('error');
                        let reason = 'Onboarding was not completed.';
                        if (!result.detailsSubmitted) reason = "Required details were not submitted to Stripe.";
                        else if (!result.payoutsEnabled) reason = "Payouts are not yet enabled by Stripe.";
                        setMessage(`Verification failed. ${reason} Please return to your settings and try again.`);
                    }
                } catch (error: any) {
                    setStatus('error');
                    setMessage(error.message);
                }
            });
        }
    }


    return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <StatusCard status={status} message={message}>
                {status === 'idle' && (
                    <Button onClick={handleVerify}>Verify Status</Button>
                )}
                 {status === 'success' && (
                    <Link href="/dashboard/settings">
                        <Button>Return to Settings</Button>
                    </Link>
                )}
                 {status === 'error' && (
                    <div className="flex gap-2 justify-center">
                        <Button onClick={handleVerify} variant="default">Try Again</Button>
                        <Link href="/dashboard/settings">
                            <Button variant="outline">Return to Settings</Button>
                        </Link>
                    </div>
                )}
            </StatusCard>
        </div>
    );
}