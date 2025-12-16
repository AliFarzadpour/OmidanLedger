'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase';
import { UserNav } from '@/components/dashboard/user-nav';
import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from "@/components/ui/separator"


export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  if (isUserLoading || !user) {
    return (
      <div className="flex min-h-screen w-full">
        <div className="hidden md:block border-r w-64 p-4 space-y-4">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-8 w-full" />
          <div className="space-y-2 pt-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </div>
        <div className="flex-1 flex flex-col">
          <header className="h-16 border-b flex items-center px-8 justify-end">
            <Skeleton className="h-10 w-10 rounded-full" />
          </header>
          <main className="p-8">
            <Skeleton className="h-8 w-1/4 mb-4" />
            <Skeleton className="h-4 w-1/2" />
          </main>
        </div>
      </div>
    );
  }
  
  return (
    <SidebarProvider>
      {/* The New Sidebar */}
      <AppSidebar />
      
      {/* The Main Content Area */}
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 bg-white">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="flex-1">
             {/* You can add Breadcrumbs here later if you want */}
          </div>
           <UserNav isMobile={true}/>
        </header>
        
        {/* The Page Content */}
        <main className="flex-1 overflow-auto p-4 md:p-8">
           {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
