'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { doc, updateDoc, getFirestore } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps } from 'firebase/app';

// Initialize Firebase using your found config
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);
const auth = getAuth(app);

function AcceptHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const propertyId = searchParams.get('propertyId');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && propertyId) {
        try {
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, {
            role: 'tenant',
            tenantPropertyId: propertyId,
            status: 'active'
          });
          router.push('/tenant/dashboard');
        } catch (error) {
          console.error("Error setting tenant role:", error);
        }
      } else if (!user) {
        // Redirect to login if not authenticated
        const currentPath = window.location.pathname + window.location.search;
        router.push(`/login?redirect=${encodeURIComponent(currentPath)}`);
      }
    });

    return () => unsubscribe();
  }, [propertyId, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h2 className="text-xl font-semibold">Finalizing your portal...</h2>
      <p className="text-gray-500">Connecting your account to your property.</p>
    </div>
  );
}

export default function TenantAcceptPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <AcceptHandler />
    </Suspense>
  );
}
