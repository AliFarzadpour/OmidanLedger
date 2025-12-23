'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type ChartData = {
  name: string;
  value: number;
};

interface SimpleBarChartProps {
  data: ChartData[];
}

export function SimpleBarChart({ data }: SimpleBarChartProps) {
  return (
    <div className="h-[350px] w-full bg-slate-50 p-4 rounded-lg border">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis 
            dataKey="name" 
            angle={-45} 
            textAnchor="end" 
            height={60} 
            interval={0}
            tick={{ fontSize: 12 }}
          />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          <Tooltip 
            cursor={{ fill: 'hsla(var(--primary), 0.1)' }}
            contentStyle={{ borderRadius: 'var(--radius)', border: '1px solid hsl(var(--border))' }}
          />
          <Bar dataKey="value" name="Count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
