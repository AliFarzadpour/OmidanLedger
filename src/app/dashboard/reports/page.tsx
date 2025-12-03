'use client';

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ArrowRight, FileText, BarChart } from 'lucide-react';

const reports = [
  {
    title: 'Expense Summary',
    description: 'A breakdown of your expenses by category.',
    href: '/dashboard/reports/expense-summary',
    icon: BarChart,
  },
  {
    title: 'Income Statement',
    description: 'A summary of your revenues and expenses over a period.',
    href: '/dashboard/reports/income-statement',
    icon: FileText,
  },
];

export default function ReportsPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">
          Generate and view reports based on your transaction data.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {reports.map((report) => (
          <Link href={report.href} key={report.title} className="group">
            <Card className="flex flex-col justify-between h-full hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-xl">{report.title}</CardTitle>
                    <report.icon className="h-6 w-6 text-muted-foreground" />
                </div>
                <CardDescription>{report.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-sm font-medium text-primary group-hover:underline">
                  View Report
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
