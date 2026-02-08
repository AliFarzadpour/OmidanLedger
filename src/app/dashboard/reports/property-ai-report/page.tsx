'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { AIPropertyReportGenerator } from '@/components/dashboard/reports/ai-property-report-generator';

export default function AIPropertyReportPage() {
  const router = useRouter();
  
  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI-Powered Property Reports</h1>
          <p className="text-muted-foreground">
            Ask our AI assistant to generate custom reports and answer questions about your property portfolio.
          </p>
        </div>
      </div>
      <AIPropertyReportGenerator />
    </div>
  );
}
