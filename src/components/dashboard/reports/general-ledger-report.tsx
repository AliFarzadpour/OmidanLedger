'use client';

import { useMemo } from 'react';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useFirestore, useUser, useCollection } from '@/firebase';
import { formatCurrency } from '@/lib/format';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

interface LedgerProps {
  bankAccountId: string;
  accountName: string;
  dateRange: { from: string; to: string };
}

export default function GeneralLedger({ bankAccountId, accountName, dateRange }: LedgerProps) {
  const { user } = useUser();
  const firestore = useFirestore();

  // 1. Direct Scoped Query - No collectionGroup needed
  const ledgerQuery = useMemo(() => {
    if (!user || !firestore || !bankAccountId) return null;
    
    return query(
      collection(firestore, `users/${user.uid}/bankAccounts/${bankAccountId}/transactions`),
      where('date', '>=', dateRange.from),
      where('date', '<=', dateRange.to),
      orderBy('date', 'desc') // Traditional ledger: newest at the top
    );
  }, [user, firestore, bankAccountId, dateRange]);

  const { data: transactions, isLoading, error } = useCollection(ledgerQuery);

  // 2. Data Processing & Normalization
  const processedLedger = useMemo(() => {
    if (!transactions) return [];

    // Note: To calculate a true running balance from DESC data, 
    // we would need the starting balance of the account. 
    // Here we focus on transaction-level detail.
    return transactions.map((tx: any) => {
      const h = tx.categoryHierarchy || {};
      
      // Apply the normalization we learned from the P&L fix
      let l2Label = (h.l2 || tx.subcategory || "Uncategorized").trim();
      if (l2Label.toLowerCase().includes("line 19")) {
        l2Label = "Line 19: Other Expenses";
      }

      return {
        ...tx,
        displayCategory: l2Label,
        isExpense: tx.amount < 0
      };
    });
  }, [transactions]);

  if (isLoading) return (
    <div className="flex justify-center p-20">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
    </div>
  );

  return (
    <Card className="w-full shadow-md">
      <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/30">
        <div>
          <CardTitle className="text-xl font-bold">General Ledger</CardTitle>
          <p className="text-sm text-muted-foreground">{accountName} • {dateRange.from} to {dateRange.to}</p>
        </div>
        <Badge variant="outline" className="text-xs">
          {processedLedger.length} Transactions
        </Badge>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[120px]">Date</TableHead>
              <TableHead>Description / Merchant</TableHead>
              <TableHead>Category (L2)</TableHead>
              <TableHead className="text-right">Debit (Exp)</TableHead>
              <TableHead className="text-right">Credit (Inc)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {processedLedger.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No transactions found for this period.
                </TableCell>
              </TableRow>
            ) : (
              processedLedger.map((tx) => (
                <TableRow key={tx.id} className="hover:bg-muted/20 transition-colors">
                  <TableCell className="font-mono text-xs">
                    {tx.date}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-sm line-clamp-1">{tx.description}</span>
                      <span className="text-[10px] text-muted-foreground uppercase">{tx.merchantName || 'Direct Payment'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-normal text-[10px]">
                      {tx.displayCategory}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-red-600 font-mono">
                    {tx.isExpense ? (
                      <div className="flex items-center justify-end gap-1">
                        {formatCurrency(Math.abs(tx.amount))}
                        <ArrowDownLeft className="h-3 w-3" />
                      </div>
                    ) : '-'}
                  </TableCell>
                  <TableCell className="text-right text-green-600 font-mono">
                    {!tx.isExpense ? (
                      <div className="flex items-center justify-end gap-1">
                        {formatCurrency(tx.amount)}
                        <ArrowUpRight className="h-3 w-3" />
                      </div>
                    ) : '-'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
