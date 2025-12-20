'use client';
import { useUser } from '@/firebase';
import { isSuperAdmin } from '@/lib/auth-utils';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/app/dashboard/layout'; 
import { Skeleton } from '@/components/ui/skeleton';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const [authStatus, setAuthStatus] = useState<'checking' | 'admin' | 'unauthorized'>('checking');

  useEffect(() => {
    if (isUserLoading) {
      return; // Wait until user state is resolved
    }
    if (!user) {
      router.push('/login'); // If no user, redirect to login
      return;
    }

    // Check if the user is a super admin
    isSuperAdmin(user.uid).then(isAdmin => {
      if (isAdmin) {
        setAuthStatus('admin');
      } else {
        setAuthStatus('unauthorized');
        router.push('/dashboard'); // If not an admin, kick them out
      }
    });
  }, [user, isUserLoading, router]);

  // While checking, show a loading state
  if (authStatus === 'checking' || authStatus === 'unauthorized') {
    return (
        <DashboardLayout>
            <div className="p-8 space-y-4">
                <Skeleton className="h-10 w-1/3" />
                <Skeleton className="h-6 w-1/2" />
                <div className="border rounded-lg p-4">
                    <Skeleton className="h-40 w-full" />
                </div>
            </div>
        </DashboardLayout>
    );
  }

  // If checks pass and user is an admin, render the layout
  return (
    <DashboardLayout>
        {children}
    </DashboardLayout>
  );
}
