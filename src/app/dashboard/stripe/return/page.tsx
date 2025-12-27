
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
    const { user, isUserLoading: isAuthLoading } = useUser(); 
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('Initializing session...');
    const [isPending, startTransition] = useTransition();

    // AUTO-VERIFY: This triggers the moment the user session is finally ready
    useEffect(() => {
        // Only run if auth is definitely finished loading AND we have a user
        if (!isAuthLoading && user?.uid && status === 'idle') {
            handleVerify();
        } 
        // If auth is finished and NO user is found, then show the error
        else if (!isAuthLoading && !user && status === 'idle') {
            setStatus('error');
            setMessage('Establishing secure session... Please wait a moment.');
        }
    }, [user, isAuthLoading, status]);

    const handleVerify = () => {
        if (!user?.uid) return; // Guard clause

        setStatus('loading');
        setMessage('Confirming your setup with Stripe...');

        startTransition(async () => {
            try {
                const result = await checkStripeAccountStatus(user.uid);
                
                if (result.isReady) {
                    setStatus('success');
                    setMessage('Setup complete! You can now collect rent and manage property expenses.');
                } else {
                    setStatus('error');
                    let reason = 'Onboarding was not completed.';
                    if (!result.detailsSubmitted) reason = "Identity verification is still required.";
                    else if (!result.payoutsEnabled) reason = "Stripe is still processing your payout details.";
                    setMessage(`Verification failed: ${reason}`);
                }
            } catch (error: any) {
                console.error("Stripe Verify Error:", error);
                setStatus('error');
                setMessage(error.message || "An unexpected error occurred.");
            }
        });
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50">
            <StatusCard 
                status={isAuthLoading ? 'loading' : status} 
                message={isAuthLoading ? 'Waiting for user session...' : message}
            >
                {/* Only show button if NOT loading and NOT success */}
                {status === 'idle' && !isAuthLoading && (
                    <Button onClick={handleVerify} disabled={isPending}>
                        {isPending ? <Loader2 className="animate-spin mr-2" /> : null}
                        Verify Status
                    </Button>
                )}
                
                {status === 'success' && (
                    <Link href="/dashboard/settings">
                        <Button className="w-full">Return to Dashboard</Button>
                    </Link>
                )}

                {status === 'error' && (
                    <div className="flex flex-col gap-3">
                        <Button onClick={handleVerify} variant="default">Try Again</Button>
                        <Link href="/dashboard/settings">
                            <Button variant="outline" className="w-full">Back to Settings</Button>
                        </Link>
                    </div>
                )}
            </StatusCard>
        </div>
    );
}
