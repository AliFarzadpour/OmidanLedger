'use client';

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ArrowRight, BrainCircuit, BookUser, FileText, ListOrdered, Building, TrendingUp } from 'lucide-react';
import { DatabaseStructureCard } from '@/components/dashboard/reports/database-structure-card';

export default function ReportsPage() {
  const reports = [
    {
      title: 'AI Financial Report',
      description: 'Use natural language to ask questions about your financial data.',
      href: '/dashboard/reports/ai-report',
      icon: BrainCircuit,
    },
    {
      title: 'AI Property Report',
      description: 'Ask questions and run analysis across your property portfolio.',
      href: '/dashboard/reports/property-ai-report',
      icon: Building,
    },
    {
      title: 'Profit & Loss',
      description: 'Review your income, expenses, and profitability over a period.',
      href: '/dashboard/reports/profit-and-loss',
      icon: FileText,
    },
    {
      title: 'Income Statement',
      description: 'A detailed breakdown of all revenue sources.',
      href: '/dashboard/reports/income-statement',
      icon: TrendingUp,
    },
    {
      title: 'General Ledger',
      description: 'A detailed history of all transactions, grouped by account.',
      href: '/dashboard/reports/general-ledger',
      icon: BookUser,
    },
    {
      title: 'Detailed Ledger',
      description: 'An interactive report of all transactions, grouped by category.',
      href: '/dashboard/reports/detailed-ledger',
      icon: ListOrdered,
    },
    {
      title: 'Chart of Accounts',
      description: 'Summary of total income and expenses by category.',
      href: '/dashboard/reports/chart-of-accounts',
      icon: BookUser,
    },
  ]
  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">
          Generate reports and review your application's data structure.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {reports.map((report) => (
          <Link href={report.href} className="group" key={report.title}>
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
                    Generate Report
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </CardContent>
              </Card>
          </Link>
        ))}
        <DatabaseStructureCard />
      </div>
    </div>
  );
}
