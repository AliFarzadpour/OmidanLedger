
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, PlayCircle } from 'lucide-react';
import { format } from 'date-fns';
import { calculateAllFees, type FeeCalculationResult } from '@/actions/calculate-billing';
import { Badge } from '@/components/ui/badge';
import { FeeBreakdownDialog } from '@/components/admin/FeeBreakdownDialog';

export default function AdminBillingPage() {
  const [billingPeriod, setBillingPeriod] = useState(format(new Date(), 'yyyy-MM'));
  const [results, setResults] = useState<FeeCalculationResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedResult, setSelectedResult] = useState<FeeCalculationResult | null>(null);

  const handleRunReport = async () => {
    setIsLoading(true);
    try {
      const data = await calculateAllFees({ billingPeriod });
      setResults(data);
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    handleRunReport();
  }, []);

  const totalRevenue = results.reduce((sum, result) => sum + (result.finalMonthlyFee || 0), 0);

  return (
    <>
      <div className="p-8 space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Monthly Billing Calculation</h1>
        
        <Card className="bg-slate-50/50">
          <CardHeader className="flex flex-row justify-between items-end">
              <div>
                  <CardTitle>Run Billing Report</CardTitle>
                  <CardDescription>Select a billing period and run the calculation.</CardDescription>
              </div>
              <div className="flex items-end gap-2">
                  <div className="grid gap-1.5">
                      <Label htmlFor="billing-period">Billing Period</Label>
                      <Input
                          id="billing-period"
                          type="month"
                          value={billingPeriod}
                          onChange={(e) => setBillingPeriod(e.target.value)}
                          className="w-[180px]"
                      />
                  </div>
                  <Button onClick={handleRunReport} disabled={isLoading}>
                      {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
                      Run Calculation
                  </Button>
              </div>
          </CardHeader>
        </Card>
        
        <Card>
          <CardHeader>
              <div className="flex items-center justify-between">
                  <CardTitle>Billing Results for {format(new Date(billingPeriod + '-02'), 'MMMM yyyy')}</CardTitle>
                  <div className="text-right">
                      <p className="text-sm text-muted-foreground">Total Estimated Revenue</p>
                      <p className="text-2xl font-bold text-green-600">${totalRevenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                  </div>
              </div>
          </CardHeader>
          <CardContent>
              <Table>
                  <TableHeader>
                      <TableRow>
                          <TableHead>Landlord Email</TableHead>
                          <TableHead>Plan</TableHead>
                          <TableHead>Active Units</TableHead>
                          <TableHead>Total Rent Collected</TableHead>
                          <TableHead>Raw Calculated Fee</TableHead>
                          <TableHead className="text-right">Final Monthly Fee</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {isLoading ? (
                          <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="animate-spin h-6 w-6" /></TableCell></TableRow>
                      ) : results.length === 0 ? (
                          <TableRow><TableCell colSpan={6} className="h-24 text-center">No landlords found.</TableCell></TableRow>
                      ) : (
                          results.map(res => (
                              <TableRow key={res.userId} onClick={() => setSelectedResult(res)} className="cursor-pointer hover:bg-muted/50">
                                  <TableCell className="font-medium">{res.userEmail}</TableCell>
                                  <TableCell><Badge variant="outline" className="capitalize">{res.subscriptionTier}</Badge></TableCell>
                                  <TableCell>{res.activeUnits}</TableCell>
                                  <TableCell>${(res.totalRentCollected || 0).toLocaleString()}</TableCell>
                                  <TableCell>${(res.rawCalculatedFee || 0).toFixed(2)}</TableCell>
                                  <TableCell className="text-right font-bold text-primary">${(res.finalMonthlyFee || 0).toFixed(2)}</TableCell>
                              </TableRow>
                          ))
                      )}
                  </TableBody>
              </Table>
          </CardContent>
        </Card>
      </div>
      {selectedResult && (
        <FeeBreakdownDialog
          isOpen={!!selectedResult}
          onOpenChange={() => setSelectedResult(null)}
          result={selectedResult}
          billingPeriod={billingPeriod}
        />
      )}
    </>
  );
}
