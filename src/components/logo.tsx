import { cn } from '@/lib/utils';
import Image from 'next/image';

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
    <div className={cn('flex items-center', className)}>
      <Image
        src="/logo.png"
        alt="OmidanLedger logo"
        width={180}
        height={40}
        priority
      />
    </div>
  );
}
