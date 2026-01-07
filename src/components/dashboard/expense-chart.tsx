
'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useMemo } from 'react';
import { formatCurrency } from '@/lib/format';

const COLORS = [
  '#2563eb', // Blue
  '#16a34a', // Green
  '#db2777', // Pink
  '#ea580c', // Orange
  '#9333ea', // Purple
  '#4b5563', // Grey (for Others)
];

type ExpenseChartProps = {
  data: { name: string; value: number }[];
  isLoading: boolean;
};

// Custom Legend Component
const CustomLegend = (props: any) => {
  const { payload, totalExpenses } = props;
  return (
    <ul className="flex flex-col space-y-2 text-sm mt-4">
      {payload.map((entry: any, index: number) => {
        const percentage = totalExpenses > 0 ? (entry.payload.value / totalExpenses) * 100 : 0;
        return (
          <li key={`item-${index}`} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span>{entry.value}</span>
            </div>
            <span className="font-medium">
              {formatCurrency(entry.payload.value)} ({percentage.toFixed(0)}%)
            </span>
          </li>
        );
      })}
    </ul>
  );
};


export function ExpenseChart({ data, isLoading }: ExpenseChartProps) {
  const { processedData, totalExpenses } = useMemo(() => {
    if (!data || data.length === 0) {
      return { processedData: [], totalExpenses: 0 };
    }

    const total = data.reduce((acc, curr) => acc + curr.value, 0);

    if (data.length <= 5) {
      return { processedData: data, totalExpenses: total };
    }

    const sortedData = [...data].sort((a, b) => b.value - a.value);
    const top5 = sortedData.slice(0, 5);
    const otherValue = sortedData.slice(5).reduce((acc, curr) => acc + curr.value, 0);

    const finalData = [...top5];
    if (otherValue > 0) {
      finalData.push({ name: 'Other', value: otherValue });
    }
    
    return { processedData: finalData, totalExpenses: total };
  }, [data]);

  const hasData = processedData && processedData.length > 0;

  return (
    <Card className="col-span-1 h-full w-full">
      <CardHeader>
        <CardTitle>Expense Breakdown</CardTitle>
        <CardDescription>
          Where your money went during this period.
        </CardDescription>
      </CardHeader>
      <CardContent className="h-full flex-1 flex flex-col pb-8">
        <div className="h-[300px] w-full pt-4">
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
                  data={processedData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {processedData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={COLORS[index % COLORS.length]} 
                      strokeWidth={0}
                    />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => [formatCurrency(value), 'Amount']}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Legend content={<CustomLegend totalExpenses={totalExpenses} />} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
