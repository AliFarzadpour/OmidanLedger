'use client';

import { WorkOrdersList } from '@/components/operations/work-orders-list';

export default function WorkOrdersPage() {
  return (
    <div className="p-8 space-y-6">
       <div>
        <h1 className="text-3xl font-bold tracking-tight">Work Orders</h1>
        <p className="text-muted-foreground">
          Track and manage all maintenance and repair jobs for your properties.
        </p>
      </div>
      <WorkOrdersList />
    </div>
  );
}
