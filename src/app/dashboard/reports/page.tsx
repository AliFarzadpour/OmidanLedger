'use client';

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ArrowRight, FileText, BarChart, BookOpen, List, BrainCircuit } from 'lucide-react';
import { DatabaseStructureCard } from '@/components/dashboard/reports/database-structure-card';

const reports = [
  {
    title: 'General Ledger',
    description: 'View a detailed history of all transactions for each bank account.',
    href: '/dashboard/reports/general-ledger',
    icon: BookOpen,
  },
  {
    title: 'Chart of Accounts',
    description: 'View all transaction categories derived from your transaction history.',
    href: '/dashboard/reports/chart-of-accounts',
    icon: List,
  },
  {
    title: 'Expense Summary',
    description: 'A breakdown of your expenses by category.',
    href: '#', // To be implemented
    icon: BarChart,
  },
  {
    title: 'Income Statement',
    description: 'A summary of your revenues and expenses over a period.',
    href: '#', // To be implemented
    icon: FileText,
  },
];

export default function ReportsPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">
          Generate reports and review your application's data structure.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <DatabaseStructureCard />
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
                {report.href === '#' ? (
                     <div className="flex items-center text-sm font-medium text-muted-foreground">
                        Coming Soon
                     </div>
                ) : (
                    <div className="flex items-center text-sm font-medium text-primary group-hover:underline">
                        View Report
                        <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </div>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
