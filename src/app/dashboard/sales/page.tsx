'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { FinancialPerformance } from '@/components/dashboard/financial-performance';
import { RentRollTable } from '@/components/dashboard/sales/RentRollTable';
import { format, addMonths, subMonths } from 'date-fns';

export default function SalesHubPage() {
  const router = useRouter();
  const [viewingDate, setViewingDate] = useState(new Date());

  return (
    <div className="space-y-8 p-8">
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard')}>
                <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Revenue Center</h1>
                <p className="text-muted-foreground mt-1">Track rents, security deposits, and tenant charges.</p>
            </div>
        </div>
        <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setViewingDate(d => subMonths(d, 1))}>
                <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-semibold text-lg w-36 text-center">{format(viewingDate, 'MMMM yyyy')}</span>
            <Button variant="outline" size="icon" onClick={() => setViewingDate(d => addMonths(d, 1))}>
                <ChevronRight className="h-4 w-4" />
            </Button>
        </div>
      </div>

      <FinancialPerformance viewingDate={viewingDate} />

      <RentRollTable viewingDate={viewingDate} />
      
    </div>
  );
}
