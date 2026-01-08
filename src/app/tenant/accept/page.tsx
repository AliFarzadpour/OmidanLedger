
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth, isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';

export default function TenantAcceptPage() {
  const router = useRouter();
  const [status, setStatus] = useState('Verifying your invitation link...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const auth = getAuth();
    const href = window.location.href;

    if (!isSignInWithEmailLink(auth, href)) {
      setError('This sign-in link is invalid or has expired. Please request a new one from your landlord.');
      setStatus('Error');
      return;
    }

    let email = window.localStorage.getItem('tenantInviteEmail');
    if (!email) {
      email = window.prompt('Please provide your email address to complete sign-in:');
    }

    if (!email) {
      setError('An email address is required to complete the sign-in process.');
      setStatus('Error');
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
        let errorMessage = 'Failed to sign in. The link may be expired, already used, or you may need to open it on the same device where the invitation was requested.';
        if (err.code === 'auth/invalid-email') {
          errorMessage = "The email you provided doesn't match the one used for the invitation.";
        }
        setError(errorMessage);
        setStatus('Error');
      });
  }, [router]);

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f8fafc' }}>
      <div style={{ maxWidth: '400px', background: 'white', padding: '32px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b' }}>Tenant Portal Sign-In</h1>
        <p style={{ marginTop: '16px', color: error ? '#dc2626' : '#475569' }}>
            {error || status}
        </p>
      </div>
    </div>
  );
}
