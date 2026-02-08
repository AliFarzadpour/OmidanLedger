'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { startOfYear, endOfYear, format } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlayCircle, Loader2, ArrowLeft } from 'lucide-react';
import GeneralLedger from '@/components/dashboard/reports/general-ledger-report';

export default function GeneralLedgerPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [dates, setDates] = useState({
    from: format(startOfYear(new Date()), 'yyyy-MM-dd'),
    to: format(endOfYear(new Date()), 'yyyy-MM-dd')
  });
  const [activeRange, setActiveRange] = useState(dates);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);

  const accountsQuery = useMemo(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, `users/${user.uid}/bankAccounts`));
  }, [user, firestore]);

  const { data: fetchedAccounts, isLoading } = useCollection(accountsQuery);

  useEffect(() => {
    if (fetchedAccounts) {
      setAccounts(fetchedAccounts);
      if (fetchedAccounts.length > 0 && !selectedAccountId) {
        setSelectedAccountId(fetchedAccounts[0].id);
      }
      setIsLoadingAccounts(false);
    }
  }, [fetchedAccounts, selectedAccountId]);
  
  const selectedAccount = useMemo(() => {
      return accounts.find(acc => acc.id === selectedAccountId);
  }, [accounts, selectedAccountId]);

  return (
    <div className="space-y-8 p-4 md:p-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
            <h1 className="text-3xl font-bold tracking-tight">General Ledger Report</h1>
            <p className="text-muted-foreground">A detailed history of all transactions for a specific account.</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-end gap-4 bg-muted/50 p-6 rounded-xl border">
        <div className="grid md:grid-cols-3 gap-4 w-full md:w-auto">
            <div className="grid gap-2">
                <Label>Account</Label>
                {isLoadingAccounts ? <Loader2 className="animate-spin" /> : (
                    <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select an account..." />
                        </SelectTrigger>
                        <SelectContent>
                            {accounts.map(acc => (
                                <SelectItem key={acc.id} value={acc.id}>
                                    {acc.accountName}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </div>
          <div className="grid gap-2">
            <Label>Start Date</Label>
            <Input type="date" value={dates.from} onChange={e => setDates(d => ({...d, from: e.target.value}))} />
          </div>
          <div className="grid gap-2">
            <Label>End Date</Label>
            <Input type="date" value={dates.to} onChange={e => setDates(d => ({...d, to: e.target.value}))} />
          </div>
        </div>
        <Button onClick={() => setActiveRange({...dates})} disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
          Run Report
        </Button>
      </div>
      
      {selectedAccount ? (
          <GeneralLedger 
              bankAccountId={selectedAccountId}
              accountName={selectedAccount.accountName}
              dateRange={activeRange}
          />
      ) : (
          <div className="text-center py-20 text-muted-foreground">
              {isLoadingAccounts ? 'Loading accounts...' : 'Please select an account to view the ledger.'}
          </div>
      )}

    </div>
  );
}
