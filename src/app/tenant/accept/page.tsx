
'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/firebase';
import { 
    isSignInWithEmailLink, 
    signInWithEmailLink,
} from 'firebase/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

function AcceptInviteContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const auth = useAuth();

    const [status, setStatus] = useState<'loading' | 'verifying' | 'success' | 'error'>('verifying');
    const [message, setMessage] = useState('Please wait while we validate your invitation...');

    useEffect(() => {
        const processSignIn = async () => {
            if (isSignInWithEmailLink(auth, window.location.href)) {
                let email = window.localStorage.getItem('emailForSignIn');
                if (!email) {
                    // This can happen if the user opens the link on a different device.
                    // We need to ask for the email.
                    email = window.prompt('Please provide your email for confirmation');
                }
                
                if (!email) {
                    setStatus('error');
                    setMessage('Email is required to complete the sign-in process.');
                    return;
                }

                try {
                    await signInWithEmailLink(auth, email, window.location.href);
                    window.localStorage.removeItem('emailForSignIn');
                    setStatus('success');
                    setMessage('You have successfully signed in! Redirecting to your portal...');

                    // Redirect to the tenant dashboard after a short delay
                    setTimeout(() => {
                        router.push('/tenant/dashboard');
                    }, 2000);
                } catch (error: any) {
                    setStatus('error');
                    setMessage(`Login failed: ${error.message}`);
                }
            } else {
                 setStatus('error');
                 setMessage('This is not a valid sign-in link. Please request a new one from your landlord.');
            }
        };

        processSignIn();

    }, [auth, router]);

    const icons = {
        loading: <Loader2 className="h-12 w-12 animate-spin text-primary" />,
        verifying: <Loader2 className="h-12 w-12 animate-spin text-primary" />,
        success: <CheckCircle2 className="h-12 w-12 text-green-500" />,
        error: <AlertCircle className="h-12 w-12 text-destructive" />,
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50">
            <Card className="w-full max-w-md text-center shadow-lg">
                <CardHeader>
                    <div className="mx-auto w-fit p-4 bg-muted rounded-full">
                        {icons[status]}
                    </div>
                    <CardTitle className="mt-4 text-2xl">
                        {status === 'success' ? 'Sign-In Successful!' : 'Finalizing Your Secure Login...'}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">{message}</p>
                    {status === 'error' && (
                        <Button asChild className="mt-6">
                            <Link href="/login">Return to Login</Link>
                        </Button>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}


export default function AcceptInvitePage() {
    return (
        <Suspense fallback={<div className="flex h-screen w-full items-center justify-center">Loading...</div>}>
            <AcceptInviteContent />
        </Suspense>
    )
}
