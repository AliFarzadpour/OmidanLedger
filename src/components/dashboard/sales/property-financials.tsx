
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Wrench, TrendingDown, ArrowUpDown, TrendingUp } from 'lucide-react';
import { format, getYear, parseISO } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format';

interface PropertyFinancialsProps {
  propertyId: string;
  propertyName: string;
  view: 'income' | 'expenses';
}

type Transaction = {
    id: string;
    date: string;
    description: string;
    categoryHierarchy: { l2: string };
    amount: number;
};

type GroupedTransactions = {
    [month: string]: {
        transactions: Transaction[];
        total: number;
    };
};

export function PropertyFinancials({ propertyId, propertyName, view }: PropertyFinancialsProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()));
  const [sortConfig, setSortConfig] = useState<{ key: keyof Transaction | 'none', direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!user || !propertyId || !firestore) return;
      setLoading(true);

      try {
        const accountsSnap = await getDocs(collection(firestore, `users/${user.uid}/bankAccounts`));
        if (accountsSnap.empty) {
            setAllTransactions([]);
            setLoading(false);
            return;
        }

        let fetchedTxs: Transaction[] = [];
        for (const accountDoc of accountsSnap.docs) {
            const txsSnap = await getDocs(collection(accountDoc.ref, 'transactions'));
            txsSnap.forEach(txDoc => {
                const data = txDoc.data();
                const isForProperty = data.costCenter === propertyId;
                const categoryL0 = data.categoryHierarchy?.l0 || '';

                let include = false;
                if (view === 'income' && isForProperty && categoryL0 === 'Income') {
                    include = true;
                } else if (view === 'expenses' && isForProperty && categoryL0 === 'Expense') {
                    include = true;
                }

                if (include) {
                    fetchedTxs.push({ id: txDoc.id, ...data } as Transaction);
                }
            });
        }
        
        setAllTransactions(fetchedTxs);

      } catch (error) {
        console.error("Error fetching financials:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [user, propertyId, view, firestore]);

  const availableYears = useMemo(() => {
      const years = new Set(allTransactions.map(tx => format(parseISO(tx.date), 'yyyy')));
      return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [allTransactions]);

  const groupedAndSortedTransactions = useMemo(() => {
    const yearFiltered = allTransactions.filter(tx => format(parseISO(tx.date), 'yyyy') === selectedYear);

    const grouped: GroupedTransactions = yearFiltered.reduce((acc, tx) => {
        const month = format(parseISO(tx.date), 'yyyy-MM');
        if (!acc[month]) {
            acc[month] = { transactions: [], total: 0 };
        }
        acc[month].transactions.push(tx);
        acc[month].total += tx.amount;
        return acc;
    }, {} as GroupedTransactions);

    if (sortConfig.key !== 'none') {
        for (const month in grouped) {
            grouped[month].transactions.sort((a, b) => {
                const key = sortConfig.key as keyof Transaction;
                const aVal = a[key];
                const bVal = b[key];

                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
    }

    return grouped;
  }, [allTransactions, selectedYear, sortConfig]);

  const sortedMonths = Object.keys(groupedAndSortedTransactions).sort((a, b) => b.localeCompare(a));

  const totalAmount = useMemo(() => {
    return Object.values(groupedAndSortedTransactions).reduce((sum, group) => sum + group.total, 0);
  }, [groupedAndSortedTransactions]);

  const handleSort = (key: keyof Transaction | 'none') => {
    setSortConfig(prev => ({
        key,
        direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  }

  const isIncome = view === 'income';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
            <CardTitle>{isIncome ? "Income Ledger" : "Expense Ledger"}</CardTitle>
            <CardDescription>
                {isIncome ? "Rent and fees collected" : "Maintenance, utilities, and tax"} for {propertyName}.
            </CardDescription>
        </div>
        <div className="flex items-center gap-4">
            <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                    {availableYears.map(year => <SelectItem key={year} value={year}>{year}</SelectItem>)}
                </SelectContent>
            </Select>
            <div className="text-right">
                <p className="text-sm text-muted-foreground">Total for {selectedYear}</p>
                <p className={`text-2xl font-bold ${isIncome ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(Math.abs(totalAmount))}
                </p>
            </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className="w-1/4"><Button variant="ghost" onClick={() => handleSort('date')}>Date <ArrowUpDown className="h-3 w-3 inline-block" /></Button></TableHead>
                    <TableHead className="w-1/2"><Button variant="ghost" onClick={() => handleSort('description')}>Description <ArrowUpDown className="h-3 w-3 inline-block" /></Button></TableHead>
                    <TableHead><Button variant="ghost" onClick={() => handleSort('categoryHierarchy')}>Category <ArrowUpDown className="h-3 w-3 inline-block" /></Button></TableHead>
                    <TableHead className="text-right"><Button variant="ghost" onClick={() => handleSort('amount')}>Amount <ArrowUpDown className="h-3 w-3 inline-block" /></Button></TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {loading ? (
                    <TableRow><TableCell colSpan={4} className="h-24 text-center">Loading financial data...</TableCell></TableRow>
                ) : sortedMonths.length > 0 ? (
                    sortedMonths.map(month => (
                       <React.Fragment key={month}>
                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                                <TableCell colSpan={3} className="font-bold">{format(parseISO(month), 'MMMM yyyy')}</TableCell>
                                <TableCell className="text-right font-bold">{formatCurrency(groupedAndSortedTransactions[month].total)}</TableCell>
                            </TableRow>
                            {groupedAndSortedTransactions[month].transactions.map((tx) => (
                                <TableRow key={tx.id}>
                                    <TableCell className="pl-8">{format(parseISO(tx.date), 'MMM dd, yyyy')}</TableCell>
                                    <TableCell className="font-medium max-w-[200px] truncate" title={tx.description}>
                                        {tx.description}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="font-normal">
                                            {tx.categoryHierarchy?.l2 || 'N/A'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className={`text-right font-medium ${isIncome ? 'text-green-600' : 'text-red-600'}`}>
                                        {isIncome ? '+' : ''}
                                        {formatCurrency(tx.amount)}
                                    </TableCell>
                                </TableRow>
                            ))}
                       </React.Fragment>
                    ))
                ) : (
                    <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                            <div className="flex flex-col items-center justify-center gap-2">
                                {isIncome ? <TrendingUp className="h-8 w-8 text-slate-200" /> : <Wrench className="h-8 w-8 text-slate-200" />}
                                <p>No {isIncome ? "income" : "expenses"} found for this property in {selectedYear}.</p>
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
