'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatCurrency } from '@/lib/format';
import { format, parseISO } from 'date-fns';
import type { InterestCalculationDetail } from './profit-and-loss-report';

interface InterestDetailDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  details: InterestCalculationDetail[];
}

export function InterestDetailDrawer({ isOpen, onOpenChange, details }: InterestDetailDrawerProps) {
  
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-[600px] sm:max-w-none flex flex-col">
        <SheetHeader>
          <SheetTitle>Mortgage Interest Breakdown</SheetTitle>
          <SheetDescription>
            This shows the calculated interest portion of your loan payments for each property, per month.
          </SheetDescription>
        </SheetHeader>
        
        <div className="mt-4 flex-1 min-h-0">
          <ScrollArea className="h-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead className="text-right">Interest Paid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {details.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={3} className="h-24 text-center">
                            No calculated interest for this period.
                        </TableCell>
                    </TableRow>
                ) : (
                    details.map((item, index) => (
                      <TableRow key={`${item.propertyId}-${item.month}-${index}`}>
                        <TableCell className="font-mono text-xs">{format(parseISO(item.month), 'MMM yyyy')}</TableCell>
                        <TableCell className="font-medium">{item.propertyName}</TableCell>
                        <TableCell className="text-right font-mono text-red-600">
                          {formatCurrency(item.interest)}
                        </TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
