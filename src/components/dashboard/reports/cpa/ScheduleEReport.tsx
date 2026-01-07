'use client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format';
import { useMemo } from 'react';

export function ScheduleEReport({ data }: { data: any[] }) {
    const { income, expenses, netIncome } = useMemo(() => {
        const income = data.filter(item => item.amount > 0).sort((a,b) => a.category.localeCompare(b.category));
        const expenses = data.filter(item => item.amount < 0).sort((a,b) => a.category.localeCompare(b.category));
        const totalIncome = income.reduce((sum, item) => sum + item.amount, 0);
        const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0);
        return { income, expenses, netIncome: totalIncome + totalExpenses };
    }, [data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Schedule E Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category (Schedule E Line)</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="bg-green-50/50 font-semibold text-green-800"><TableCell>Income</TableCell><TableCell></TableCell></TableRow>
            {income.map((item, index) => (
              <TableRow key={`inc-${index}`}>
                <TableCell className="pl-8">{item.category}</TableCell>
                <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
              </TableRow>
            ))}

            <TableRow className="bg-red-50/50 font-semibold text-red-800"><TableCell>Expenses</TableCell><TableCell></TableCell></TableRow>
            {expenses.map((item, index) => (
              <TableRow key={`exp-${index}`}>
                <TableCell className="pl-8">{item.category}</TableCell>
                <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="font-bold bg-muted text-lg">
                <TableCell>Net Income</TableCell>
                <TableCell className="text-right">{formatCurrency(netIncome)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
