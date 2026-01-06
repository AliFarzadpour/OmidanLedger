
'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { type FeeCalculationResult } from '@/actions/calculate-billing';
import { format } from 'date-fns';
import { AlertCircle } from 'lucide-react';

interface FeeBreakdownDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  result: FeeCalculationResult;
  billingPeriod: string;
}

export function FeeBreakdownDialog({ isOpen, onOpenChange, result, billingPeriod }: FeeBreakdownDialogProps) {
  if (!result) return null;

  const {
    userEmail,
    breakdown,
    totalRentCollected,
    rawMonthlyFee,
    finalMonthlyFee,
  } = result;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Fee Breakdown for {userEmail}</DialogTitle>
          <DialogDescription>
            Showing calculation details for the billing period of {format(new Date(billingPeriod + '-02'), 'MMMM yyyy')}.
          </DialogDescription>
        </DialogHeader>
        
        <div className="max-h-[60vh] overflow-y-auto pr-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unit / Space</TableHead>
                <TableHead className="text-right">Rent Collected</TableHead>
                <TableHead className="text-right">Fee Generated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {breakdown.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center h-24 text-muted-foreground">
                    No rental income recorded for this period.
                  </TableCell>
                </TableRow>
              ) : (
                breakdown.map(item => (
                  <TableRow key={item.spaceId}>
                    <TableCell className="font-medium">{item.spaceName}</TableCell>
                    <TableCell className="text-right">${(item.collectedRent || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">${(item.fee || 0).toFixed(2)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="space-y-4 pt-4 border-t">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Total Rent Collected:</span>
            <span className="font-medium">${(totalRentCollected || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Sum of Per-Unit Fees (Raw Fee):</span>
            <span className="font-medium">${(rawMonthlyFee || 0).toFixed(2)}</span>
          </div>
           <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Monthly Minimum:</span>
            <span className="font-medium">$29.00</span>
          </div>
          <div className="flex justify-between items-center font-bold text-lg border-t pt-4">
            <span>Final Monthly Fee:</span>
            <span className="text-primary">${(finalMonthlyFee || 0).toFixed(2)}</span>
          </div>

           <div className="flex items-start gap-3 text-xs text-muted-foreground bg-slate-50 p-3 rounded-md">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <p>
                    The <strong>Raw Calculated Fee</strong> is the sum of individual fees for each unit (0.75% of rent, capped at $30 per unit). The <strong>Final Monthly Fee</strong> is the greater of the Raw Fee or the $29.00 monthly minimum.
                </p>
            </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
