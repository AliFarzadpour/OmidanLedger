import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ReactNode } from 'react';
import { formatCurrency } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';

type StatCardProps = {
  title: string;
  value: number;
  icon: ReactNode;
  description?: string;
  isLoading?: boolean;
  format?: 'currency' | 'percent';
};

export function StatCard({ title, value, icon, description, isLoading, format = 'currency' }: StatCardProps) {
  
  const formattedValue = () => {
    if (format === 'percent') {
      return `${value.toFixed(1)}%`;
    }
    return formatCurrency(value);
  }

  return (
    <Card className="shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-3/4" />
        ) : (
          <div className="text-2xl font-bold">{formattedValue()}</div>
        )}
        {description && !isLoading && <p className="text-xs text-muted-foreground">{description}</p>}
      </CardContent>
    </Card>
  );
}
