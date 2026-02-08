'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { formatCurrency } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Scale, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TrialBalanceReport() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [accountBalances, setAccountBalances] = useState<any[]>([]);

  useEffect(() => {
    async function fetchTrialBalance() {
      if (!user || !firestore) return;
      setLoading(true);
      
      try {
        // 1. Fetch all bank accounts for the user
        const accountsRef = collection(firestore, `users/${user.uid}/bankAccounts`);
        const accountsSnap = await getDocs(accountsRef);
        
        const balances = await Promise.all(accountsSnap.docs.map(async (doc) => {
          const accountData = doc.data();
          
          // 2. Fetch all transactions for this specific account to get the sum
          // No collectionGroup needed, avoiding security rule roadblocks
          const txRef = collection(firestore, `users/${user.uid}/bankAccounts/${doc.id}/transactions`);
          const txSnap = await getDocs(txRef);
          
          let total = 0;
          txSnap.forEach(tx => {
            total += (Number(tx.data().amount) || 0);
          });

          return {
            id: doc.id,
            name: accountData.accountName || 'Unnamed Account',
            officialName: accountData.accountNumber || 'N/A',
            type: accountData.accountType || 'depository',
            balance: total
          };
        }));

        setAccountBalances(balances);
      } catch (error) {
        console.error("Trial Balance Error:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchTrialBalance();
  }, [user, firestore]);

  const grandTotal = useMemo(() => {
    return accountBalances.reduce((acc, curr) => acc + curr.balance, 0);
  }, [accountBalances]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20 space-y-4">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="text-muted-foreground animate-pulse">Balancing ledgers...</p>
    </div>
  );

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
        </Button>
        <Scale className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Trial Balance</h1>
          <p className="text-muted-foreground">Verify debits and credits across all accounts.</p>
        </div>
      </div>

      <Card className="shadow-lg border-t-4 border-t-primary">
        <CardHeader className="bg-slate-50/50 border-b">
          <CardTitle className="text-center text-sm uppercase tracking-widest text-muted-foreground">
            Current Account Standings
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Account Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Debit (Owed)</TableHead>
                <TableHead className="text-right">Credit (Asset)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accountBalances.map((acc) => {
                const isAsset = acc.balance >= 0;
                return (
                  <TableRow key={acc.id} className="hover:bg-muted/10 transition-colors">
                    <TableCell>
                      <div className="font-semibold">{acc.name}</div>
                      <div className="text-[10px] text-muted-foreground">{acc.officialName}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize text-[10px]">
                        {acc.type}
                      </Badge>
                    </TableCell>
                    {/* Color Logic: Red for negative/debts, Green for positive/assets */}
                    <TableCell className="text-right font-mono text-red-600">
                      {!isAsset ? formatCurrency(Math.abs(acc.balance)) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-green-600">
                      {isAsset ? formatCurrency(acc.balance) : '-'}
                    </TableCell>
                  </TableRow>
                );
              })}
              
              <TableRow className="bg-slate-900 text-white font-black text-xl">
                <TableCell colSpan={2}>Net Business Value</TableCell>
                <TableCell colSpan={2} className="text-right">
                  {formatCurrency(grandTotal)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <p className="text-[10px] text-muted-foreground text-center italic">
        * Trial Balance aggregates all historical transactions per account. Ensure all bank imports are complete for accuracy.
      </p>
    </div>
  );
}
