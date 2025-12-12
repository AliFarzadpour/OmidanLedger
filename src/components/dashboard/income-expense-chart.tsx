'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format';

type IncomeExpenseChartProps = {
  data: {
    name: string;
    income: number;
    expenses: number;
  }[];
  isLoading: boolean;
};

export function IncomeExpenseChart({ data, isLoading }: IncomeExpenseChartProps) {
  const hasData = data && data.length > 0;

  return (
    <Card className="col-span-1">
      <CardHeader>
        <CardTitle>Income vs. Expenses</CardTitle>
        <CardDescription>Monthly cash flow summary.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          {isLoading ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              Loading chart...
            </div>
          ) : !hasData ? (
            <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
              <p>No data for this period</p>
              <p className="text-xs">Select a different date range.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.5} />
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${(value as number) / 1000}k`} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  cursor={{ fill: 'hsl(var(--muted))', radius: 4 }}
                  contentStyle={{
                    background: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 'var(--radius)',
                  }}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="income" stackId="a" fill="var(--color-green-500, #22c55e)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" stackId="a" fill="var(--color-red-500, #ef4444)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
