'use client';
import { useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { doc, updateDoc, getFirestore, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
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
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && propertyId) {
        try {
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, {
            role: 'tenant',
            tenantPropertyId: propertyId,
            status: 'active'
          });

          const q = query(
            collection(db, 'users'), 
            where('email', '==', user.email?.toLowerCase()), 
            where('status', '==', 'invited')
          );
          
          const querySnapshot = await getDocs(q);
          for (const placeholderDoc of querySnapshot.docs) {
            if (placeholderDoc.id !== user.uid) {
              await deleteDoc(doc(db, 'users', placeholderDoc.id));
            }
          }
          router.push('/tenant/dashboard');
        } catch (error) {
          console.error("Sync error:", error);
        }
      }
    });
    return () => unsubscribe();
  }, [propertyId, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h2 className="text-xl font-semibold">Syncing your tenant profile...</h2>
    </div>
  );
}

export default function TenantAcceptPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AcceptHandler />
    </Suspense>
  );
}
