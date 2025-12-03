'use client';

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ArrowRight, BookText, Scale, Files, FileText } from 'lucide-react';

const reports = [
  {
    title: 'General Ledger',
    description: 'View a detailed list of all transactions for each account.',
    href: '/dashboard/reports/general-ledger',
    icon: BookText,
  },
  {
    title: 'Chart of Accounts',
    description: 'See the complete list of all accounts in your accounting system.',
    href: '/dashboard/reports/chart-of-accounts',
    icon: Files,
  },
  {
    title: 'Trial Balance',
    description: 'A summary of debits and credits to verify bookkeeping accuracy.',
    href: '/dashboard/reports/trial-balance',
    icon: Scale,
  },
  {
    title: 'Journal Entries',
    description: 'Review all manual journal entries recorded in the system.',
    href: '/dashboard/reports/journal-entries',
    icon: FileText,
  },
];

export default function ReportsPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">
          Generate and view standard bookkeeping and transaction reports.
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
