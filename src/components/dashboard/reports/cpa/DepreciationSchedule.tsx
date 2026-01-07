'use client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format';

export function DepreciationSchedule({ data }: { data: any[] }) {
  const totalBasis = data.reduce((sum, item) => sum + item.basis, 0);
  const totalAnnualDep = data.reduce((sum, item) => sum + item.annualDepreciation, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Depreciation Schedule</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Property</TableHead>
              <TableHead>In-Service Date</TableHead>
              <TableHead>Depreciable Basis</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Useful Life</TableHead>
              <TableHead>Annual Depreciation</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item, index) => (
              <TableRow key={index}>
                <TableCell>{item.property}</TableCell>
                <TableCell>{item.inServiceDate}</TableCell>
                <TableCell>{formatCurrency(item.basis)}</TableCell>
                <TableCell>{item.method}</TableCell>
                <TableCell>{item.usefulLife} yrs</TableCell>
                <TableCell>{formatCurrency(item.annualDepreciation)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="font-bold bg-muted/50">
              <TableCell colSpan={2}>Totals</TableCell>
              <TableCell>{formatCurrency(totalBasis)}</TableCell>
              <TableCell colSpan={2}></TableCell>
              <TableCell>{formatCurrency(totalAnnualDep)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
