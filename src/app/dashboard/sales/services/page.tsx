'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Plus, 
  Search, 
  Filter, 
  ArrowUpRight, 
  Clock, 
  CheckCircle2, 
  FileText 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ServiceInvoicesPage() {
  const [searchTerm, setSearchTerm] = useState('');

  // Placeholder data - we will replace this with Firebase data later
  const invoices: any[] = []; 
  // const invoices = [
  //   { id: '1', number: 'INV-001', client: 'Acme Corp', date: '2024-10-24', amount: 1200, status: 'paid' },
  // ];

  return (
    <div className="space-y-8 p-8">
      
      {/* 1. Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Service Invoices</h1>
          <p className="text-muted-foreground mt-1">Manage consulting, hourly work, and project billing.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" /> Filter
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700 gap-2" asChild>
            <Link href="/dashboard/sales/services/new">
              <Plus className="h-4 w-4" /> New Service Invoice
            </Link>
          </Button>
        </div>
      </div>

      {/* 2. KPI Cards (The Dashboard) */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding (Unpaid)</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$0.00</div>
            <p className="text-xs text-muted-foreground mt-1">0 invoices pending</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Collected this Month</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$0.00</div>
            <p className="text-xs text-muted-foreground mt-1">+0% from last month</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-slate-400 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Drafts</CardTitle>
            <FileText className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$0.00</div>
            <p className="text-xs text-muted-foreground mt-1">Work in progress</p>
          </CardContent>
        </Card>
      </div>

      {/* 3. Search Bar */}
      <div className="flex items-center space-x-2 bg-white p-1 rounded-lg border shadow-sm max-w-md">
        <Search className="h-4 w-4 text-muted-foreground ml-2" />
        <Input 
          placeholder="Search by client or invoice #..." 
          className="border-0 focus-visible:ring-0"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* 4. The List (Empty State vs Table) */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden min-h-[400px]">
        {invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="bg-blue-50 p-4 rounded-full mb-4">
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">No Service Invoices Yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-2 mb-6">
              Create your first invoice to bill for hours, projects, or retainers. We'll track the payments for you.
            </p>
            <Button className="bg-blue-600 hover:bg-blue-700" asChild>
              <Link href="/dashboard/sales/services/new">
                Create First Invoice
              </Link>
            </Button>
          </div>
        ) : (
          <div className="p-4">
             {/* We will build the table here in Phase 2 */}
             <p>Table goes here...</p>
          </div>
        )}
      </div>

    </div>
  );
}