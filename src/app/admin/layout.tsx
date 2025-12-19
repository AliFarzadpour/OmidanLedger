'use client';
import { useUser } from '@/firebase';
import { isSuperAdmin } from '@/lib/auth-utils';
import { useEffect, useState } from 'react';
import { redirect, useRouter } from 'next/navigation';
import Link from 'next/link';

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

  // If checks pass, render the admin layout
  return (
    <div className="flex min-h-screen">
       <nav className="w-64 border-r bg-slate-50 p-6">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Admin</h3>
        <ul className="space-y-2">
          <li><Link href="/admin" className="text-blue-600 font-medium">Dashboard</Link></li>
          <li><Link href="/admin/users" className="hover:text-blue-600">Landlords</Link></li>
          <li><a href="#" className="hover:text-blue-600 text-slate-400 cursor-not-allowed">Billing Logs</a></li>
        </ul>
      </nav>
      <main className="flex-1 p-10 bg-slate-50/50">
        {children}
      </main>
    </div>
  );
}
