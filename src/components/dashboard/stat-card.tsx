
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ReactNode } from 'react';
import { formatCurrency } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ArrowDown, ArrowUp } from 'lucide-react';

type StatCardProps = {
  title: string;
  value: number;
  icon: ReactNode;
  description?: string;
  isLoading?: boolean;
  format?: 'currency' | 'percent' | 'months';
  cardClassName?: string;
  delta?: number;
  deltaInverted?: boolean;
};

export function StatCard({ title, value, icon, description, isLoading, format = 'currency', cardClassName, delta, deltaInverted = false }: StatCardProps) {
  
  const formattedValue = () => {
    if (format === 'percent') {
      return `${value.toFixed(1)}%`;
    }
     if (format === 'months') {
        return `${value.toFixed(0)} mos`;
    }
    return formatCurrency(value);
  }

  const isPositive = delta ? (deltaInverted ? delta < 0 : delta > 0) : false;
  const isNegative = delta ? (deltaInverted ? delta > 0 : delta < 0) : false;
  
  return (
    <Card className={cn("shadow-lg h-full flex flex-col", cardClassName)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 min-h-[4.5rem]">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent className="flex-grow flex flex-col justify-center">
        {isLoading ? (
          <Skeleton className="h-8 w-3/4" />
        ) : (
            <>
              <div className="text-xl font-bold">{formattedValue()}</div>
              {delta !== undefined && isFinite(delta) && (
                  <div className={cn(
                      "flex items-center gap-1 text-xs font-semibold",
                      isPositive ? "text-green-600" : isNegative ? "text-red-600" : "text-muted-foreground"
                  )}>
                      {isPositive && <ArrowUp className="h-3 w-3" />}
                      {isNegative && <ArrowDown className="h-3 w-3" />}
                      {delta.toFixed(1)}% vs last period
                  </div>
              )}
            </>
        )}
        {description && !isLoading && <p className="text-xs text-muted-foreground">{description}</p>}
      </CardContent>
    </Card>
  );
}

    