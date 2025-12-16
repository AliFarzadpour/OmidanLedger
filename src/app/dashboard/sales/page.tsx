'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Home, 
  CreditCard, 
  Users, 
  ArrowUpRight,
  Wallet,
  ArrowLeft
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SalesHubPage() {
  const router = useRouter();

  return (
    <div className="space-y-8 p-8">
      
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Revenue Center</h1>
            <p className="text-muted-foreground mt-1">Track rents, security deposits, and tenant charges.</p>
        </div>
      </div>

      {/* KPI Section (Placeholder - can be connected to real data later) */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-sm border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Collected Rent (Nov)</CardTitle>
            <Wallet className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$12,450.00</div>
            <p className="text-xs text-muted-foreground mt-1">92% of expected rent</p>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Overdue / Late</CardTitle>
            <ClockIcon className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$1,250.00</div>
            <p className="text-xs text-muted-foreground mt-1">2 tenants pending</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Occupancy Rate</CardTitle>
            <Home className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">94%</div>
            <p className="text-xs text-muted-foreground mt-1">1 unit vacant</p>
          </CardContent>
        </Card>
      </div>

      {/* Action Cards Grid - The "Plan A" Focus */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        
        {/* Card 1: Rent Collection (Future Feature) */}
        <Card className="hover:shadow-md transition-shadow cursor-pointer border-slate-200">
          <CardHeader>
            <div className="bg-green-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
              <Wallet className="h-6 w-6 text-green-700" />
            </div>
            <CardTitle>Collect Rent</CardTitle>
            <CardDescription>Log monthly rent payments from tenants.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full bg-green-600 hover:bg-green-700" asChild>
              <Link href="/dashboard/properties">Record Payment</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Card 2: Tenant Invoice (What we just built) */}
        <Card className="hover:shadow-md transition-shadow cursor-pointer border-slate-200">
          <CardHeader>
            <div className="bg-blue-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
              <FileText className="h-6 w-6 text-blue-700" />
            </div>
            <CardTitle>Invoice Tenant</CardTitle>
            <CardDescription>Charge for repairs, utilities, or late fees.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full bg-blue-600 hover:bg-blue-700" asChild>
              <Link href="/dashboard/sales/services">Create Charge</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Card 3: Security Deposits */}
        <Card className="hover:shadow-md transition-shadow cursor-pointer border-slate-200">
          <CardHeader>
            <div className="bg-purple-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
              <CreditCard className="h-6 w-6 text-purple-700" />
            </div>
            <CardTitle>Security Deposits</CardTitle>
            <CardDescription>Manage escrow and move-in funds.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">Manage Deposits</Button>
          </CardContent>
        </Card>

        {/* Card 4: Tenant List */}
        <Card className="hover:shadow-md transition-shadow cursor-pointer border-slate-200">
          <CardHeader>
            <div className="bg-slate-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
              <Users className="h-6 w-6 text-slate-700" />
            </div>
            <CardTitle>Tenants</CardTitle>
            <CardDescription>View contact info and lease details.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" asChild>
                {/* Assuming you have a tenants page or properties page */}
                <Link href="/dashboard/properties">View Tenants</Link>
            </Button>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}

// Simple icon component for the KPI card
function ClockIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}
