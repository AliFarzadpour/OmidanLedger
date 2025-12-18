'use client';

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ArrowRight, BrainCircuit, BookUser, FileText, ListOrdered } from 'lucide-react';

export default function ReportsPage() {
  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">
          Generate reports and review your application's data structure.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Link href="/dashboard/reports/ai-report" className="group">
            <Card className="flex flex-col justify-between h-full hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-xl">AI Report</CardTitle>
                    <BrainCircuit className="h-6 w-6 text-muted-foreground" />
                </div>
                <CardDescription>Use AI to ask questions about your financial data.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-sm font-medium text-primary group-hover:underline">
                  Generate Report
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </CardContent>
            </Card>
        </Link>
      </div>
    </div>
  );
}
