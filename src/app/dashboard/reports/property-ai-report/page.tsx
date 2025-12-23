'use client';

import { AIPropertyReportGenerator } from '@/components/dashboard/reports/ai-property-report-generator';

export default function AIPropertyReportPage() {
  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI-Powered Property Reports</h1>
        <p className="text-muted-foreground">
          Ask our AI assistant to generate custom reports and answer questions about your property portfolio.
        </p>
      </div>
      <AIPropertyReportGenerator />
    </div>
  );
}
