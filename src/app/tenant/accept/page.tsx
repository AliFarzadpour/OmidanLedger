'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';

// 1. Create a child component for the logic
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
          // After updating role, go to the actual dashboard
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
      <h2 className="text-xl font-semibold">Setting up your portal...</h2>
      <p className="text-gray-500">Please wait while we connect your account.</p>
    </div>
  );
}

// 2. The main page exports the component wrapped in Suspense
export default function TenantAcceptPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <AcceptHandler />
    </Suspense>
  );
}
