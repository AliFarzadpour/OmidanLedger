'use client';

import { Pie, PieChart, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import { expenseData } from '@/lib/data';

const chartConfig = {
  value: {
    label: 'Value',
  },
  groceries: {
    label: 'Groceries',
    color: 'hsl(var(--chart-1))',
  },
  dining: {
    label: 'Dining',
    color: 'hsl(var(--chart-2))',
  },
  utilities: {
    label: 'Utilities',
    color: 'hsl(var(--chart-3))',
  },
  transport: {
    label: 'Transport',
    color: 'hsl(var(--chart-4))',
  },
  shopping: {
    label: 'Shopping',
    color: 'hsl(var(--chart-5))',
  },
};

export function ExpenseChart() {
  return (
    <Card className="flex h-full flex-col shadow-lg">
      <CardHeader>
        <CardTitle>Expense Breakdown</CardTitle>
        <CardDescription>July 2024</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[300px]">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
            <Pie data={expenseData} dataKey="value" nameKey="name" innerRadius={60}>
              {expenseData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <ChartLegend
              content={<ChartLegendContent nameKey="name" />}
              className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center"
            />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
