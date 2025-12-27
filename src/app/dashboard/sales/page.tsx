
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
import { FinancialPerformance } from '@/components/dashboard/financial-performance';
import { EnterBillDialog } from '@/components/dashboard/sales/enter-bill-dialog';
import { CreateChargeDialog } from '@/components/dashboard/sales/CreateChargeDialog';
import { useEffect, useState } from 'react';

// Client-side-only wrapper to prevent hydration errors
function ClientOnly({ children }: { children: React.ReactNode }) {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return null;
  }

  return <>{children}</>;
}


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

      <FinancialPerformance />

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
            <ClientOnly>
             <EnterBillDialog 
                triggerButton={
                    <Button className="w-full bg-green-600 hover:bg-green-700">Record Payment</Button>
                } 
             />
            </ClientOnly>
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
            <ClientOnly>
              <CreateChargeDialog />
            </ClientOnly>
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
