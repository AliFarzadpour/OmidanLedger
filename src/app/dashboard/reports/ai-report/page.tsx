'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { AIReportGenerator } from '@/components/dashboard/reports/ai-report-generator';

export default function AIReportPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI-Powered Reports</h1>
          <p className="text-muted-foreground">
            Ask our AI assistant to generate custom financial reports and answer your questions.
          </p>
        </div>
      </div>
      <AIReportGenerator />
    </div>
  );
}
