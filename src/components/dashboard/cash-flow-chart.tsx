
'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { format, parseISO, startOfMonth } from 'date-fns';
import { formatCurrency } from '@/lib/format';
import { ArrowUpRight, ArrowDownRight, Scale } from 'lucide-react';

type DailyData = {
  date: string;
  income: number;
  expense: number;
};

type CashFlowProps = {
  data: DailyData[];
  isLoading: boolean;
};

// New function to aggregate daily data into monthly totals
const aggregateDataByMonth = (data: DailyData[]): DailyData[] => {
  const monthlyData: { [key: string]: { income: number; expense: number } } = {};

  data.forEach(item => {
    const month = format(startOfMonth(parseISO(item.date)), 'yyyy-MM-dd');
    if (!monthlyData[month]) {
      monthlyData[month] = { income: 0, expense: 0 };
    }
    monthlyData[month].income += item.income;
    monthlyData[month].expense += item.expense;
  });

  return Object.keys(monthlyData).map(month => ({
    date: month,
    income: monthlyData[month].income,
    expense: monthlyData[month].expense,
  }));
};

const calculateSummary = (data: DailyData[]) => {
    if (data.length === 0) {
        return { netCashFlow: 0, bestDay: { date: '', value: 0 }, worstDay: { date: '', value: 0 } };
    }

    let netCashFlow = 0;
    let bestDay = { date: data[0].date, value: -Infinity };
    let worstDay = { date: data[0].date, value: Infinity };

    data.forEach(item => {
        const dailyNet = item.income - item.expense;
        netCashFlow += dailyNet;

        if (dailyNet > bestDay.value) {
            bestDay = { date: item.date, value: dailyNet };
        }
        if (dailyNet < worstDay.value) {
            worstDay = { date: item.date, value: dailyNet };
        }
    });

    return { netCashFlow, bestDay, worstDay };
};

export function CashFlowChart({ data, isLoading }: CashFlowProps) {
  const monthlyData = useMemo(() => aggregateDataByMonth(data), [data]);
  const summary = useMemo(() => calculateSummary(data), [data]);
  
  const hasData = monthlyData.length > 0;

  return (
    <Card className="col-span-1 lg:col-span-3">
      <CardHeader>
        <CardTitle>Cash Flow Trend</CardTitle>
        <CardDescription>Monthly income vs. expenses for the selected period.</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Summary Row */}
        <div className="grid grid-cols-3 gap-4 mb-6 text-center">
            <div className="p-3 bg-slate-50 border rounded-lg">
                <div className="text-sm text-muted-foreground flex items-center justify-center gap-1"><Scale className="h-4 w-4"/> Net Cash Flow</div>
                <p className={`text-lg font-bold ${summary.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(summary.netCashFlow)}
                </p>
            </div>
             <div className="p-3 bg-slate-50 border rounded-lg">
                <div className="text-sm text-muted-foreground flex items-center justify-center gap-1"><ArrowUpRight className="h-4 w-4 text-green-500"/> Best Day</div>
                <p className="text-lg font-bold">{formatCurrency(summary.bestDay.value)}</p>
                <p className="text-xs text-muted-foreground">{summary.bestDay.date ? format(parseISO(summary.bestDay.date), 'MMM d') : '-'}</p>
            </div>
             <div className="p-3 bg-slate-50 border rounded-lg">
                <div className="text-sm text-muted-foreground flex items-center justify-center gap-1"><ArrowDownRight className="h-4 w-4 text-red-500"/> Worst Day</div>
                <p className="text-lg font-bold">{formatCurrency(summary.worstDay.value)}</p>
                 <p className="text-xs text-muted-foreground">{summary.worstDay.date ? format(parseISO(summary.worstDay.date), 'MMM d') : '-'}</p>
            </div>
        </div>

        <div className="h-[300px] w-full">
          {isLoading ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">Loading...</div>
          ) : !hasData ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">No data for this period</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(val) => format(parseISO(val), 'MMM')} 
                  fontSize={12}
                />
                <YAxis fontSize={12} tickFormatter={(val: number) => `$${(val/1000).toFixed(0)}k`} />
                <Tooltip 
                  formatter={(value: number) => [formatCurrency(value), '']}
                  labelFormatter={(label) => format(parseISO(label), 'MMMM yyyy')}
                  contentStyle={{
                    background: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 'var(--radius)',
                  }}
                />
                <Legend />
                {/* Softer Colors */}
                <Bar dataKey="income" name="Income" fill="#86efac" radius={[4, 4, 0, 0]} /> 
                <Bar dataKey="expense" name="Expenses" fill="#fca5a5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
