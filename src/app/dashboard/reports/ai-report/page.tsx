'use client';

import { AIReportGenerator } from '@/components/dashboard/reports/ai-report-generator';

export default function AIReportPage() {
  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI-Powered Reports</h1>
        <p className="text-muted-foreground">
          Ask our AI assistant to generate custom financial reports and answer your questions.
        </p>
      </div>
      <AIReportGenerator />
    </div>
  );
}
