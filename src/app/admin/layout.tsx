'use client';
import { useUser } from '@/firebase';
import { isSuperAdmin } from '@/lib/auth-utils';
import { useEffect, useState } from 'react';
import { redirect, useRouter } from 'next/navigation';
import DashboardLayout from '@/app/dashboard/layout'; // Use standard layout

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (isUserLoading) {
      return; // Wait until user state is resolved
    }
    if (!user) {
      router.push('/login'); // If no user, redirect to login
      return;
    }

    // Check if the user is a super admin
    isSuperAdmin(user.uid).then(result => {
      if (!result) {
        // If not an admin, kick them out
        router.push('/dashboard');
      } else {
        // If they are an admin, allow access
        setIsAdmin(true);
      }
      // Finished checking
      setIsChecking(false);
    });
  }, [user, isUserLoading, router]);

  // While checking, show a loading state
  if (isChecking || !isAdmin) {
    return <div>Loading & Verifying Access...</div>;
  }

  // If checks pass, render the standard dashboard layout
  return (
    <DashboardLayout>
        {children}
    </DashboardLayout>
  );
}
