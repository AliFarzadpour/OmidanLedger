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
import { Skeleton } from '@/components/ui/skeleton';

const chartColors = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

interface ExpenseChartProps {
    data: { name: string; value: number }[];
    isLoading?: boolean;
}

export function ExpenseChart({ data, isLoading }: ExpenseChartProps) {
  const chartConfig = data.reduce((acc, item, index) => {
    acc[item.name] = {
      label: item.name,
      color: chartColors[index % chartColors.length],
    };
    return acc;
  }, {} as any);

  const chartData = data.map((item, index) => ({
      ...item,
      fill: chartColors[index % chartColors.length],
  }))

  return (
    <Card className="flex h-full flex-col shadow-lg">
      <CardHeader>
        <CardTitle>Expense Breakdown</CardTitle>
        <CardDescription>A summary of your expenses by primary category.</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-full aspect-square max-h-[300px] mx-auto">
            <Skeleton className="h-full w-full rounded-full" />
          </div>
        ) : data.length > 0 ? (
          <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[300px]">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
              <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={60}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <ChartLegend
                content={<ChartLegendContent nameKey="name" />}
                className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center"
              />
            </PieChart>
          </ChartContainer>
        ) : (
          <div className="flex h-full min-h-[250px] items-center justify-center">
            <p className="text-sm text-muted-foreground">No expense data for this period.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
