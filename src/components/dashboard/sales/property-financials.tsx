
'use client';

import { useEffect, useState } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { collection, query, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowDownCircle, Wrench, TrendingUp, TrendingDown } from 'lucide-react';
import { format } from 'date-fns';

interface PropertyFinancialsProps {
  propertyId: string;
  propertyName: string;
  view: 'income' | 'expenses';
}

export function PropertyFinancials({ propertyId, propertyName, view }: PropertyFinancialsProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalAmount, setTotalAmount] = useState(0);

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!user || !propertyId || !firestore) return;
      setLoading(true);

      try {
        // Fetch all bank accounts for the user
        const accountsSnap = await getDocs(collection(firestore, `users/${user.uid}/bankAccounts`));
        if (accountsSnap.empty) {
            setTransactions([]);
            setLoading(false);
            return;
        }

        // Fetch all transactions from all accounts
        let allUserTransactions: any[] = [];
        for (const accountDoc of accountsSnap.docs) {
            const txsSnap = await getDocs(collection(accountDoc.ref, 'transactions'));
            txsSnap.forEach(txDoc => {
                allUserTransactions.push({ id: txDoc.id, ...txDoc.data() });
            });
        }
        
        // Filter transactions client-side
        const filteredTxs = allUserTransactions.filter(tx => {
            const isForProperty = tx.costCenter === propertyId;
            const categoryL0 = tx.categoryHierarchy?.l0 || '';

            if (view === 'income') {
                return isForProperty && categoryL0 === 'Income';
            }
            if (view === 'expenses') {
                return isForProperty && categoryL0 === 'Expense';
            }
            return false;
        });

        // Sort by date desc
        filteredTxs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        setTransactions(filteredTxs);
        setTotalAmount(filteredTxs.reduce((sum, t) => sum + t.amount, 0));

      } catch (error) {
        console.error("Error fetching financials:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [user, propertyId, view, firestore]);

  const isIncome = view === 'income';

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading financial data...</div>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
            <CardTitle>{isIncome ? "Income Ledger" : "Expense Ledger"}</CardTitle>
            <CardDescription>
                {isIncome ? "Rent and fees collected" : "Maintenance, utilities, and tax"} for {propertyName}.
            </CardDescription>
        </div>
        <div className="text-right">
            <p className="text-sm text-muted-foreground">Total {isIncome ? "Collected" : "Spent"}</p>
            <p className={`text-2xl font-bold ${isIncome ? 'text-green-600' : 'text-red-600'}`}>
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(totalAmount))}
            </p>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {transactions.length > 0 ? (
                    transactions.map((tx) => (
                        <TableRow key={tx.id}>
                            <TableCell>{format(new Date(tx.date), 'MMM dd, yyyy')}</TableCell>
                            <TableCell className="font-medium max-w-[200px] truncate" title={tx.description}>
                                {tx.description}
                            </TableCell>
                            <TableCell>
                                <Badge variant="outline" className="font-normal">
                                    {tx.categoryHierarchy?.l2 || tx.accountName}
                                </Badge>
                            </TableCell>
                            <TableCell className={`text-right font-medium ${isIncome ? 'text-green-600' : 'text-red-600'}`}>
                                {isIncome ? '+' : ''}
                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(tx.amount)}
                            </TableCell>
                        </TableRow>
                    ))
                ) : (
                    <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                            <div className="flex flex-col items-center justify-center gap-2">
                                {isIncome ? <ArrowDownCircle className="h-8 w-8 text-slate-200" /> : <Wrench className="h-8 w-8 text-slate-200" />}
                                <p>No {isIncome ? "income" : "expenses"} found for this property yet.</p>
                            </div>
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
