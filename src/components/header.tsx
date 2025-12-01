import { cn } from '@/lib/utils';
import type { HTMLAttributes } from 'react';

export function Header({ className, children }: HTMLAttributes<HTMLDivElement>) {
  return (
    <header
      className={cn(
        'sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:px-8',
        className
      )}
    >
      {children}
    </header>
  );
}
