'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';

function AcceptContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const propertyId = searchParams.get('propertyId');

  useEffect(() => {
    async function updateRole() {
      if (user && propertyId) {
        try {
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, {
            role: 'tenant',
            tenantPropertyId: propertyId
          });
          router.push('/tenant/dashboard');
        } catch (e) {
          console.error("Failed to update role:", e);
        }
      }
    }
    updateRole();
  }, [user, propertyId, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p>Finalizing your portal access...</p>
    </div>
  );
}

export default function TenantAcceptPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AcceptContent />
    </Suspense>
  );
}
