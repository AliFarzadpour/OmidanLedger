'use client';

import { useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/dashboard/stat-card';
import { ExpenseChart } from '@/components/dashboard/expense-chart';
import { RecentTransactions } from '@/components/dashboard/recent-transactions';
import { DollarSign, CreditCard, Landmark, Upload } from 'lucide-react';

export default function DashboardPage() {
  const { user } = useUser();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome Back, {user?.email?.split('@')[0] || 'User'}!</h1>
          <p className="text-muted-foreground">Here&apos;s a summary of your financial activity.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Total Balance"
          value="$12,430.50"
          icon={<Landmark className="h-6 w-6 text-primary" />}
          description="+20.1% from last month"
        />
        <StatCard
          title="Monthly Income"
          value="$4,500.00"
          icon={<DollarSign className="h-6 w-6 text-green-500" />}
          description="From salary"
        />
        <StatCard
          title="Monthly Expenses"
          value="-$1,345.90"
          icon={<CreditCard className="h-6 w-6 text-red-500" />}
          description="-5.2% from last month"
        />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <ExpenseChart />
        </div>
        <div className="lg:col-span-3">
          <RecentTransactions />
        </div>
      </div>
    </div>
  );
}
