'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';

export default function TenantAcceptPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const propertyId = searchParams.get('propertyId');

  useEffect(() => {
    async function joinProperty() {
      if (user && propertyId) {
        // 1. Update the user role to "tenant" in Firestore
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          role: 'tenant',
          tenantPropertyId: propertyId
        });

        // 2. Take them to their new dashboard
        router.push('/tenant/dashboard');
      }
    }
    joinProperty();
  }, [user, propertyId, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p>Setting up your tenant portal... Please wait.</p>
    </div>
  );
}
