'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const COLORS = [
  '#2563eb', // Blue
  '#16a34a', // Green
  '#db2777', // Pink
  '#ea580c', // Orange
  '#9333ea', // Purple
  '#0891b2', // Cyan
  '#ca8a04', // Yellow
  '#4b5563', // Grey (for Others)
];

type ExpenseChartProps = {
  data: { name: string; value: number }[];
  isLoading: boolean;
};

export function ExpenseChart({ data, isLoading }: ExpenseChartProps) {
  // Prevent graph from breaking if data is empty
  const hasData = data && data.length > 0;

  return (
    <Card className="col-span-1">
      <CardHeader>
        <CardTitle>Expense Breakdown</CardTitle>
        <CardDescription>
          Where your money went during this period.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          {isLoading ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              Loading chart...
            </div>
          ) : !hasData ? (
            <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
              <p>No expense data available</p>
              <p className="text-xs">Try selecting a different date range.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={60} // Makes it a Donut Chart
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={COLORS[index % COLORS.length]} 
                      strokeWidth={0}
                    />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => [`$${value.toLocaleString()}`, 'Amount']}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Legend 
                  layout="vertical" 
                  verticalAlign="middle" 
                  align="right"
                  wrapperStyle={{ fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
