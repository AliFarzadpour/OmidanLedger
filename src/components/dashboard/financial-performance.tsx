'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where } from 'firebase/firestore';
import { useUser, useFirestore } from '@/firebase';
import { ArrowUpRight, ArrowDownRight, DollarSign } from 'lucide-react';

export function FinancialPerformance() {
  const { user } = useUser();
  const db = useFirestore();

  // 1. Fetch Transactions (Securely filtered by user)
  const transactionsQuery = user 
    ? query(collection(db, 'users', user.uid, 'bankAccounts'), where('userId', '==', user.uid))
    // Note: In reality, you'd likely use a Collection Group query for 'transactions' 
    // or fetch from your specialized 'ledgerEntries' collection if you have one.
    : null;

  // Placeholder: Assuming you have a way to aggregate 'transactions' or 'ledgerEntries'
  // For this demo, let's assume we pass in pre-calculated stats or fetch them.
  
  const stats = {
    income: 12450.00,
    expenses: 4210.50, // Example data
    netIncome: 8239.50
  };

  return (
    <Card className="col-span-4">
      <CardHeader>
        <CardTitle>Financial Performance (This Month)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          
          {/* INCOME CARD */}
          <div className="p-4 border rounded-lg bg-green-50/50 border-green-100">
            <div className="flex items-center gap-2 text-sm font-medium text-green-800">
              <ArrowUpRight className="h-4 w-4" /> Total Income
            </div>
            <div className="mt-2 text-2xl font-bold text-green-700">
              ${stats.income.toLocaleString()}
            </div>
            <p className="text-xs text-green-600/80">+12% from last month</p>
          </div>

          {/* EXPENSE CARD */}
          <div className="p-4 border rounded-lg bg-red-50/50 border-red-100">
            <div className="flex items-center gap-2 text-sm font-medium text-red-800">
              <ArrowDownRight className="h-4 w-4" /> Total Expenses
            </div>
            <div className="mt-2 text-2xl font-bold text-red-700">
              ${stats.expenses.toLocaleString()}
            </div>
            <p className="text-xs text-red-600/80">-5% from last month</p>
          </div>

          {/* NET INCOME CARD */}
          <div className="p-4 border rounded-lg bg-blue-50/50 border-blue-100">
            <div className="flex items-center gap-2 text-sm font-medium text-blue-800">
              <DollarSign className="h-4 w-4" /> Net Operating Income
            </div>
            <div className="mt-2 text-2xl font-bold text-blue-700">
              ${stats.netIncome.toLocaleString()}
            </div>
            <p className="text-xs text-blue-600/80">66% Margin</p>
          </div>

        </div>

        {/* Placeholder for Chart */}
        <div className="h-[200px] w-full bg-slate-50 mt-6 rounded-md flex items-center justify-center text-muted-foreground border border-dashed">
          [ Bar Chart: Income vs Expense by Month ]
        </div>

      </CardContent>
    </Card>
  );
}
