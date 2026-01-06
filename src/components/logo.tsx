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
        src="https://storage.googleapis.com/project-os-prod/images/56994a5e-01e9-45f0-b0aa-9a77f9038234.png"
        alt="OmidanLedger logo"
        width={180}
        height={40}
        priority
      />
    </div>
  );
}
