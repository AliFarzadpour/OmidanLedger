
'use client';

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Inbox, ListChecks, Wrench, Users, Loader2 } from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';

function HubCard({ title, description, href, kpi, icon: Icon, isLoading }: any) {
  return (
    <Card className="flex flex-col justify-between hover:shadow-lg transition-shadow">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
            <div>
                <CardTitle className="text-xl flex items-center gap-2">
                    <Icon className="h-5 w-5 text-primary" />
                    {title}
                </CardTitle>
                <CardDescription className="mt-2">{description}</CardDescription>
            </div>
             <div className="text-right">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground"/> : (
                     <p className="text-2xl font-bold">{kpi.value}</p>
                )}
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
            </div>
        </div>
      </CardHeader>
      <CardFooter>
         <Button asChild className="w-full">
            <Link href={href}>
                Open <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
         </Button>
      </CardFooter>
    </Card>
  )
}

export default function OperationsHubPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  // Fetch data for KPIs
  const threadsQuery = useMemoFirebase(() => user ? query(collection(firestore, `users/${user.uid}/opsThreads`), where('status', '==', 'open')) : null, [user, firestore]);
  const tasksQuery = useMemoFirebase(() => user ? query(collection(firestore, `users/${user.uid}/opsTasks`), where('status', '!=', 'done')) : null, [user, firestore]);
  const workOrdersQuery = useMemoFirebase(() => user ? query(collection(firestore, `users/${user.uid}/opsWorkOrders`), where('status', '!=', 'completed')) : null, [user, firestore]);
  const vendorsQuery = useMemoFirebase(() => user ? query(collection(firestore, 'vendors'), where('userId', '==', user.uid)) : null, [user, firestore]);
  
  const { data: openThreads, isLoading: loadingThreads } = useCollection(threadsQuery);
  const { data: activeTasks, isLoading: loadingTasks } = useCollection(tasksQuery);
  const { data: activeWorkOrders, isLoading: loadingWorkOrders } = useCollection(workOrdersQuery);
  const { data: vendors, isLoading: loadingVendors } = useCollection(vendorsQuery);

  const isLoading = loadingThreads || loadingTasks || loadingWorkOrders || loadingVendors;

  const hubItems = [
    {
      title: 'Inbox',
      description: 'Manage all property-related communications.',
      href: '/dashboard/operations/inbox',
      icon: Inbox,
      kpi: { value: openThreads?.length ?? '—', label: 'open threads' },
      isLoading: loadingThreads,
    },
    {
      title: 'Tasks',
      description: 'Track to-do items and recurring duties.',
      href: '/dashboard/operations/tasks',
      icon: ListChecks,
      kpi: { value: activeTasks?.length ?? '—', label: 'active tasks' },
      isLoading: loadingTasks,
    },
    {
      title: 'Work Orders',
      description: 'Assign and monitor maintenance and repair jobs.',
      href: '/dashboard/operations/work-orders',
      icon: Wrench,
      kpi: { value: activeWorkOrders?.length ?? '—', label: 'active orders' },
      isLoading: loadingWorkOrders,
    },
    {
      title: 'Vendors',
      description: 'Your rolodex of contractors and professionals.',
      href: '/dashboard/vendors',
      icon: Users,
      kpi: { value: vendors?.length ?? '—', label: 'total vendors' },
      isLoading: loadingVendors,
    },
  ];

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Operations Center</h1>
        <p className="text-muted-foreground">
          Manage tasks, communication, vendors, and property work.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {hubItems.map((item) => (
          <HubCard key={item.title} {...item} />
        ))}
      </div>
    </div>
  );
}
