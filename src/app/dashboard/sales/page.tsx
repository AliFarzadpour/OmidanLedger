'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft
} from 'lucide-react';
import { FinancialPerformance } from '@/components/dashboard/financial-performance';
import { RentRollTable } from '@/components/dashboard/sales/RentRollTable';

export default function SalesHubPage() {
  const router = useRouter();

  return (
    <div className="space-y-8 p-8">
      
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Revenue Center</h1>
            <p className="text-muted-foreground mt-1">Track rents, security deposits, and tenant charges.</p>
        </div>
      </div>

      <FinancialPerformance />

      <RentRollTable />
      
    </div>
  );
}
