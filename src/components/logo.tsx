import { cn } from '@/lib/utils';
import { Landmark } from 'lucide-react';

export function Logo({
  showIcon = true,
  showText = true,
  className,
}: {
  showIcon?: boolean;
  showText?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {showIcon && <Landmark className="h-7 w-7 text-primary" />}
      {showText && <span className="text-xl font-bold text-foreground">FiscalFlow</span>}
    </div>
  );
}
