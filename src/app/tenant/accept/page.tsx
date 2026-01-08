
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth, isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';
import { initializeFirebase } from '@/firebase';

export default function TenantAcceptPage() {
  const router = useRouter();
  const [msg, setMsg] = useState('Finishing sign-in...');
  const { firebaseApp } = initializeFirebase();

  useEffect(() => {
    const auth = getAuth(firebaseApp);
    const url = window.location.href;

    // email stored earlier on same device OR ask user
    const savedEmail = window.localStorage.getItem('tenantInviteEmail') || '';

    async function run() {
      try {
        if (!isSignInWithEmailLink(auth, url)) {
          setMsg('Invalid or expired sign-in link.');
          return;
        }

        let email = savedEmail;
        if (!email) {
          email = window.prompt('Please confirm your email to finish sign-in') || '';
        }
        if (!email) {
          setMsg('Email is required to finish sign-in.');
          return;
        }

        await signInWithEmailLink(auth, email, url);
        window.localStorage.removeItem('tenantInviteEmail');

        // send tenant to their portal
        router.replace('/tenant/dashboard');
      } catch (e: any) {
        setMsg(e?.message || 'Sign-in failed.');
      }
    }

    run();
  }, [router, firebaseApp]);

  return (
    <div style={{ padding: 24, fontFamily: 'Arial, sans-serif' }}>
      <h2>Tenant Portal</h2>
      <p>{msg}</p>
    </div>
  );
}
