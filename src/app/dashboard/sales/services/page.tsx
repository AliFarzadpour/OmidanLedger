'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useUser, useFirestore, useCollection } from '@/firebase'; // Use your hooks
import { collection, query, where, orderBy } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Plus, 
  Search, 
  Filter, 
  Clock, 
  CheckCircle2, 
  FileText,
  Loader2,
  Pencil,
  Trash2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


export default function ServiceInvoicesPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');

  const invoicesQuery = useMemo(() => {
    if (!user || !firestore) return null;
    
    return query(
      collection(firestore, 'invoices'), 
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
  }, [user, firestore]);

  const { data: invoices, isLoading } = useCollection(invoicesQuery);

  // 3. Client-Side Filter (Search)
  const filteredInvoices = (invoices || []).filter((inv: any) => 
    inv.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 4. Calculate KPIs Dynamically
  const totalOutstanding = (invoices || [])
    .filter((inv: any) => inv.status === 'open' || inv.status === 'overdue')
    .reduce((sum: number, inv: any) => sum + (inv.balanceDue || 0), 0);

  const draftCount = (invoices || []).filter((inv: any) => inv.status === 'draft').length;

  // Placeholder for "Collected this month" (requires payment logic later)
  const collectedThisMonth = 0; 

  return (
    <div className="space-y-8 p-8">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Service Invoices</h1>
          <p className="text-muted-foreground mt-1">Manage consulting, hourly work, and project billing.</p>
        </div>
        <div className="flex gap-3">
          <Button className="bg-blue-600 hover:bg-blue-700 gap-2" asChild>
            <Link href="/dashboard/sales/services/new">
              <Plus className="h-4 w-4" /> New Service Invoice
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding (Unpaid)</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalOutstanding.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Pending revenue</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Collected this Month</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${collectedThisMonth.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Cash in bank</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-slate-400 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Drafts</CardTitle>
            <FileText className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{draftCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Work in progress</p>
          </CardContent>
        </Card>
      </div>

      {/* Search Bar */}
      <div className="flex items-center space-x-2 bg-white p-1 rounded-lg border shadow-sm max-w-md">
        <Search className="h-4 w-4 text-muted-foreground ml-2" />
        <Input 
          placeholder="Search by client or invoice #..." 
          className="border-0 focus-visible:ring-0"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Invoice List */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden min-h-[400px]">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
             <div className="bg-slate-50 p-4 rounded-full mb-4">
              <FileText className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">No invoices found</h3>
            <p className="text-sm text-muted-foreground mt-2">
              {searchTerm ? "Try adjusting your search terms." : "Create your first invoice to get started."}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
              <tr>
                <th className="px-6 py-3">Number</th>
                <th className="px-6 py-3">Client</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3 text-right">Amount</th>
                <th className="px-6 py-3 text-center">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map((inv: any) => (
                <tr key={inv.id} className="bg-white border-b hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">{inv.invoiceNumber}</td>
                  <td className="px-6 py-4">{inv.clientName}</td>
                  <td className="px-6 py-4 text-slate-500">
                    {inv.issueDate?.seconds ? new Date(inv.issueDate.seconds * 1000).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-right font-medium">
                    ${(inv.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Badge variant={
                      inv.status === 'open' ? 'default' : 
                      inv.status === 'paid' ? 'secondary' : 
                      inv.status === 'overdue' ? 'destructive' : 'outline'
                    } className={
                        inv.status === 'open' ? 'bg-blue-100 text-blue-700 hover:bg-blue-100' :
                        inv.status === 'paid' ? 'bg-green-100 text-green-700 hover:bg-green-100' :
                        inv.status === 'draft' ? 'bg-slate-100 text-slate-700 hover:bg-slate-100' : ''
                    }>
                      {inv.status ? inv.status.charAt(0).toUpperCase() + inv.status.slice(1) : 'Unknown'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end items-center gap-2">
                      <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                        <Link href={`/dashboard/sales/services/${inv.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}
