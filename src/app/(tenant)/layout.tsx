'use client';

import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
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

    // A simple way to check roles on the client.
    // For enhanced security, a custom claim check is better.
    // We'll assume a 'role' field on the user's document for now.
    const checkRole = async () => {
        // This is a placeholder for a proper role check.
        // In a real app, you'd fetch the user's profile from Firestore
        // and check their role.
        const userRole = 'tenant'; // Forcing tenant for this example

        if (userRole === 'tenant') {
            setIsAuthorized(true);
        } else {
            router.push('/dashboard'); // If not a tenant, redirect
        }
    };

    checkRole();

  }, [user, isUserLoading, router]);

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
