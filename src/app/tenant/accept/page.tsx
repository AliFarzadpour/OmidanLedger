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

    const [status, setStatus] = useState<'loading' | 'verifying' | 'signing-in' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('Please wait while we validate your invitation...');

    useEffect(() => {
        const processInvite = async () => {
            const token = searchParams.get('token');
            if (!token) {
                setStatus('error');
                setMessage('No invitation token found. Please use the link from your email.');
                return;
            }

            // In a real app, you'd call a server action/API route here to validate the token server-side
            // For simplicity, we'll assume the client can proceed if a token exists, and let the server-side
            // `isSignInWithEmailLink` be the main gatekeeper.
            
            setStatus('verifying');
            const email = window.localStorage.getItem('emailForSignIn');
            
            if (isSignInWithEmailLink(auth, window.location.href)) {
                if (!email) {
                    // This happens if the user opens the link on a different device.
                    // You would typically prompt for the email again here.
                    setStatus('error');
                    setMessage('Your email is required to complete sign-in. Please try again on the original device.');
                    return;
                }
                
                setStatus('signing-in');
                setMessage('Finalizing your secure login...');

                try {
                    await signInWithEmailLink(auth, email, window.location.href);
                    window.localStorage.removeItem('emailForSignIn');

                    // Here you would typically call another server action to update the `invites` status to 'accepted'
                    // and the `users` (tenant) document to `status: 'active'`.

                    setStatus('success');
                    setMessage('You have successfully activated your account!');

                    // Redirect to the tenant dashboard after a short delay
                    setTimeout(() => {
                        router.push('/tenant/dashboard');
                    }, 2000);

                } catch (error: any) {
                    setStatus('error');
                    setMessage(`Login failed: ${error.message}`);
                }

            } else {
                // This is the first time the user is clicking the link.
                // We need to trigger the sign-in flow.
                setStatus('loading');
                setMessage('Preparing your secure login...');
                
                // You would need a server action here to get the email associated with the token.
                // For demonstration, we'll assume we can get it. Let's hardcode it for now.
                // In a real implementation: const { email } = await validateInviteToken(token);
                const inviteEmail = "tenant@example.com"; // **REPLACE WITH SERVER-SIDE LOOKUP**
                
                window.localStorage.setItem('emailForSignIn', inviteEmail);
                
                const { sendSignInLinkToEmail } = await import('firebase/auth');
                
                try {
                    await sendSignInLinkToEmail(auth, inviteEmail, {
                        url: window.location.href, // The user will be redirected back to this same URL
                        handleCodeInApp: true,
                    });
                    setStatus('success');
                    setMessage(`A secure login link has been sent to ${inviteEmail}. Please check your inbox to complete the setup.`);
                } catch(error: any) {
                    setStatus('error');
                    setMessage(`Could not send login link: ${error.message}`);
                }
            }
        };

        processInvite();

    }, [searchParams, auth, router]);

    const icons = {
        loading: <Loader2 className="h-12 w-12 animate-spin text-primary" />,
        verifying: <Loader2 className="h-12 w-12 animate-spin text-primary" />,
        'signing-in': <Loader2 className="h-12 w-12 animate-spin text-primary" />,
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
                        {status === 'success' ? 'Link Sent!' : 'Accepting Invitation...'}
                    </TardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">{message}</p>
                    {status === 'success' && (
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
