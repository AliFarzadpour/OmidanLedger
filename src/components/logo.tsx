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
        src="https://firebasestorage.googleapis.com/v0/b/studio-7576922301-bac28.firebasestorage.app/o/logos%2FOmidanLedger%20logo%20Rightside%20trimed.png?alt=media&token=80772977-26b5-4080-b0f4-30eccf9cc323"
        alt="OmidanLedger logo"
        width={180}
        height={40}
        priority
      />
    </div>
  );
}
