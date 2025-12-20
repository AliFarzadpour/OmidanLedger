'use client';

import { useUser, useFirestore, useDoc } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { doc } from 'firebase/firestore';

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    if (isUserLoading) {
      return; // Wait for user to be loaded
    }
    if (!user) {
      router.push('/login'); // Not logged in, go to login
      return;
    }
    
    // Asynchronously check the user's role from Firestore.
    const checkRole = async () => {
      if (!firestore) return;
      const userDocRef = doc(firestore, 'users', user.uid);
      const { getDoc } = await import('firebase/firestore');
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists() && userDoc.data().role === 'tenant') {
        setIsAuthorized(true);
      } else {
        // If not a tenant or doc doesn't exist, redirect to the main landlord dashboard.
        router.push('/dashboard');
      }
    };

    checkRole();

  }, [user, isUserLoading, router, firestore]);

  const handleLogout = () => {
    // This assumes your useAuth hook or a utility provides a signOut method.
    // As it's not in the context, this is a conceptual placeholder.
    // auth.signOut().then(() => router.push('/login'));
    alert('Placeholder for logout functionality.');
  };

  if (!isAuthorized) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Loading & Verifying Access...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="border-b bg-white p-4 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Logo />
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500">{user?.email}</span>
            <Button variant="outline" size="sm" onClick={handleLogout}>Logout</Button>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-7xl p-6">{children}</main>
    </div>
  );
}
