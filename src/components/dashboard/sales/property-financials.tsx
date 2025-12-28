
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { collection, query, getDocs, where, collectionGroup } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Wrench, TrendingUp, HandCoins } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/format';

interface PropertyFinancialsProps {
  propertyId: string;
  propertyName: string;
  view: 'income' | 'expenses' | 'deposits';
}

type Transaction = {
    id: string;
    date: string;
    description: string;
    categoryHierarchy: { l0: string; l2: string };
    costCenter?: string;
    amount: number;
};

type GroupedTransactions = {
    [month: string]: {
        transactions: Transaction[];
        total: number;
    };
};

// Normalize category to handle both old and new schemas
function normalizeL0(tx: any): string {
    const raw = String(tx?.categoryHierarchy?.l0 || tx?.primaryCategory || '').toUpperCase();
    if (raw === 'INCOME') return 'INCOME';
    if (raw === 'OPERATING EXPENSE') return 'OPERATING EXPENSE';
    if (raw === 'EXPENSE') return 'EXPENSE';
    if (raw === 'ASSET') return 'ASSET';
    if (raw === 'LIABILITY') return 'LIABILITY';
    if (raw === 'EQUITY') return 'EQUITY';
    if (raw.includes('INCOME')) return 'INCOME';
    if (raw.includes('EXPENSE')) return 'OPERATING EXPENSE';
    return 'OPERATING EXPENSE';
}

export function PropertyFinancials({ propertyId, propertyName, view }: PropertyFinancialsProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()));

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!user || !propertyId || !firestore) return;
      setLoading(true);

      try {
        const txsQuery = query(
            collectionGroup(firestore, 'transactions'),
            where('userId', '==', user.uid),
            where('costCenter', '==', propertyId) // Correctly filter by costCenter
        );
        const txsSnap = await getDocs(txsQuery);
        let fetchedTxs: Transaction[] = txsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
        
        // Client-side filtering based on view using normalized category
        fetchedTxs = fetchedTxs.filter(tx => {
            const l0 = normalizeL0(tx);
            const categoryL1 = (tx as any).categoryHierarchy?.l1 || '';

            if (view === 'income' && l0 === 'INCOME') return true;
            if (view === 'expenses' && (l0 === 'EXPENSE' || l0 === 'OPERATING EXPENSE')) return true;
            if (view === 'deposits' && l0 === 'LIABILITY' && categoryL1 === 'Tenant Deposits') return true;
            return false;
        });
        
        fetchedTxs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
      if (allTransactions.length === 0) return ['All', String(new Date().getFullYear())];
      const years = new Set(allTransactions.map(tx => format(parseISO(tx.date), 'yyyy')));
      const sortedYears = Array.from(years).sort((a, b) => b.localeCompare(a));
      return ['All', ...sortedYears];
  }, [allTransactions]);

  const groupedTransactions = useMemo(() => {
    const yearFiltered = selectedYear === 'All'
        ? allTransactions
        : allTransactions.filter(tx => format(parseISO(tx.date), 'yyyy') === selectedYear);

    const grouped: GroupedTransactions = yearFiltered.reduce((acc, tx) => {
        const month = format(parseISO(tx.date), 'yyyy-MM');
        if (!acc[month]) {
            acc[month] = { transactions: [], total: 0 };
        }
        acc[month].transactions.push(tx);
        acc[month].total += tx.amount;
        return acc;
    }, {} as GroupedTransactions);

    return grouped;
  }, [allTransactions, selectedYear]);

  const sortedMonths = Object.keys(groupedTransactions).sort((a, b) => b.localeCompare(a));

  const totalAmount = useMemo(() => {
    return Object.values(groupedTransactions).reduce((sum, group) => sum + group.total, 0);
  }, [groupedTransactions]);

  const viewConfig = {
      income: { title: 'Income Ledger', desc: 'Rent and fees collected', color: 'text-green-600', icon: <TrendingUp className="h-8 w-8 text-slate-200" /> },
      expenses: { title: 'Expense Ledger', desc: 'Maintenance, utilities, and tax', color: 'text-red-600', icon: <Wrench className="h-8 w-8 text-slate-200" /> },
      deposits: { title: 'Deposit Ledger', desc: 'Security deposits held and returned', color: 'text-blue-600', icon: <HandCoins className="h-8 w-8 text-slate-200" /> },
  }

  const currentView = viewConfig[view];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
            <CardTitle>{currentView.title}</CardTitle>
            <CardDescription>
                {currentView.desc} for {propertyName}.
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
                <p className={`text-2xl font-bold ${currentView.color}`}>
                    {formatCurrency(Math.abs(totalAmount))}
                </p>
            </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className="w-1/4">Date</TableHead>
                    <TableHead className="w-1/2">Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {loading ? (
                    <TableRow><TableCell colSpan={4} className="h-24 text-center">Loading financial data...</TableCell></TableRow>
                ) : sortedMonths.length > 0 ? (
                    sortedMonths.map(month => {
                        const monthData = groupedTransactions[month];
                        const showTotal = monthData.transactions.length > 1;

                        return (
                           <React.Fragment key={month}>
                                {showTotal && (
                                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                                        <TableCell colSpan={3} className="font-bold">{format(parseISO(month), 'MMMM yyyy')}</TableCell>
                                        <TableCell className="text-right font-bold">{formatCurrency(monthData.total)}</TableCell>
                                    </TableRow>
                                )}
                                {monthData.transactions.map((tx) => (
                                    <TableRow key={tx.id}>
                                        <TableCell className={showTotal ? "pl-8" : ""}>{format(parseISO(tx.date), 'MMM dd, yyyy')}</TableCell>
                                        <TableCell className="font-medium max-w-[200px] truncate" title={tx.description}>
                                            {tx.description}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="font-normal">
                                                {tx.categoryHierarchy?.l2 || 'N/A'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className={`text-right font-medium ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {tx.amount > 0 ? '+' : ''}
                                            {formatCurrency(tx.amount)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                           </React.Fragment>
                        )
                    })
                ) : (
                    <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                            <div className="flex flex-col items-center justify-center gap-2">
                                {currentView.icon}
                                <p>No {view} found for this property in {selectedYear}.</p>
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
