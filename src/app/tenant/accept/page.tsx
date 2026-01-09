'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';

// Standard client-side config check
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

function AcceptHandler() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const propertyId = searchParams.get('propertyId');

  useEffect(() => {
    async function updateTenantRole() {
      if (user && propertyId) {
        try {
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, {
            role: 'tenant',
            tenantPropertyId: propertyId
          });
          router.push('/tenant/dashboard');
        } catch (error) {
          console.error("Error setting tenant role:", error);
        }
      }
    }
    updateTenantRole();
  }, [user, propertyId, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h2 className="text-xl font-semibold">Finalizing your portal...</h2>
      <p className="text-gray-500">Connecting your account to your new home.</p>
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
