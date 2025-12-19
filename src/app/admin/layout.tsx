
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
      return;
    }
    if (!user) {
      router.push('/login');
      return;
    }

    isSuperAdmin(user.uid).then(result => {
      if (!result) {
        router.push('/dashboard');
      } else {
        setIsAdmin(true);
      }
      setIsChecking(false);
    });
  }, [user, isUserLoading, router]);

  if (isChecking || !isAdmin) {
    // You can replace this with a proper loading spinner
    return <div>Loading & Verifying Access...</div>;
  }

  return (
    <div className="flex">
      <aside className="w-64 bg-slate-800 text-white p-4 h-screen">
        <h2 className="font-bold text-lg mb-4">Admin Panel</h2>
        <nav>
          <ul>
            <li className="mb-2">
              <Link href="/admin" className="hover:text-slate-300">Overview</Link>
            </li>
            <li className="mb-2">
              <Link href="/admin/users" className="hover:text-slate-300">User Management</Link>
            </li>
          </ul>
        </nav>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
