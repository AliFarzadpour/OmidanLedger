'use client';
import { useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { doc, updateDoc, getFirestore } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps } from 'firebase/app';
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);
const auth = getAuth(app);
function AcceptHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const propertyId = searchParams.get('propertyId');
  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (user && propertyId) {
        try {
          await updateDoc(doc(db, 'users', user.uid), {
            role: 'tenant',
            tenantPropertyId: propertyId,
            status: 'active'
          });
          router.push('/tenant/dashboard');
        } catch (e) { console.error(e); }
      }
    });
  }, [propertyId, router]);
  return <div className='p-10 text-center'>Finalizing account...</div>;
}
export default function TenantAcceptPage() {
  return <Suspense><AcceptHandler /></Suspense>;
}
