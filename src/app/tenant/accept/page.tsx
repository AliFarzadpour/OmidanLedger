
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth, isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';
import { useAuth } from '@/firebase'; // Import the useAuth hook

export default function TenantAcceptPage() {
  const router = useRouter();
  const auth = useAuth(); // Use the hook to get the initialized Auth instance
  const [status, setStatus] = useState('Initializing...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // The effect will re-run when `auth` becomes available.
    if (!auth) {
      // Auth is not ready yet, wait for the provider.
      return;
    }

    const href = window.location.href;
    setStatus('Verifying your invitation link...');

    if (!isSignInWithEmailLink(auth, href)) {
      setError('This sign-in link is invalid or has expired. Please request a new one from your landlord.');
      return;
    }

    let email = window.localStorage.getItem('tenantInviteEmail');
    if (!email) {
      email = window.prompt('Please provide your email for confirmation:');
    }

    if (!email) {
      setError('An email address is required to complete the sign-in process.');
      return;
    }

    setStatus('Confirming your email and signing you in...');
    signInWithEmailLink(auth, email, href)
      .then((result) => {
        window.localStorage.removeItem('tenantInviteEmail');
        setStatus('Success! Redirecting you to your tenant portal...');
        // Use router.replace to prevent the user from navigating back to the accept page
        router.replace('/tenant/dashboard');
      })
      .catch((err) => {
        console.error('Sign-in with email link error:', err);
        setError(`Failed to sign in. The link may be expired, already used, or you may need to open it on the same device where the invitation was requested.`);
      });
  }, [auth, router]); // Dependency on `auth` ensures this runs when Firebase is ready.

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Tenant Portal Sign-In</h1>
      {error ? (
        <p style={{ marginTop: '16px', color: '#dc2626' }}>{error}</p>
      ) : (
        <p style={{ marginTop: '16px', color: '#666' }}>{status}</p>
      )}
    </div>
  );
}
