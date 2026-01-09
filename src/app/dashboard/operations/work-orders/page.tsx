export const dynamic = 'force-dynamic';

import { WorkOrdersList } from '@/components/operations/work-orders-list';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';


export default function WorkOrdersPage() {

  return (
    <div className="p-8 space-y-6">
       <div className="flex items-center gap-4">
        <Link href="/dashboard/operations">
            <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
            </Button>
        </Link>
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Work Orders</h1>
            <p className="text-muted-foreground">
            Track and manage all maintenance and repair jobs for your properties.
            </p>
        </div>
       </div>
      <WorkOrdersList />
    </div>
  );
}
