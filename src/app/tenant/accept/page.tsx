
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
      setError('This sign-in link is invalid or has expired. Please request a new one.');
      return;
    }

    // The email must be stored in localStorage for this to work seamlessly
    const storedEmail = window.localStorage.getItem('tenantInviteEmail');
    
    if (!storedEmail) {
      setError('Your browser storage is missing the email address. Please try opening the link in the same browser you used to request it, or try again.');
      return;
    }

    setStatus('Confirming your email and signing you in...');
    signInWithEmailLink(auth, storedEmail, href)
      .then((result) => {
        window.localStorage.removeItem('tenantInviteEmail');
        setStatus('Success! Redirecting you to your tenant portal...');
        // Redirect to the main tenant dashboard after successful sign-in
        router.replace('/tenant/dashboard'); 
      })
      .catch((err) => {
        console.error('Sign-in with email link error:', err);
        setError(`Failed to sign in. The link may be expired or already used. Please request a new invitation from your landlord.`);
      });
  }, [router]);

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
