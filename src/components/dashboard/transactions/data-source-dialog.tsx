'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useUser, useFirestore } from '@/firebase';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Separator } from '@/components/ui/separator';
import { exchangePublicToken, createLinkToken } from '@/lib/plaid';
import { useToast } from '@/hooks/use-toast';
import { PlaidLinkOnSuccessMetadata, usePlaidLink } from 'react-plaid-link';
import { Label } from '@/components/ui/label';

const dataSourceSchema = z.object({
  accountName: z.string().min(1, 'Account name is required.'),
  bankName: z.string().min(1, 'Bank name is required.'),
  accountType: z.enum(['checking', 'savings', 'credit-card', 'cash', 'credit', 'other']),
  accountNumber: z.string().optional(),

  // NEW:
  importStart: z.enum(['thisYear', 'lastYear']).default('lastYear'),
});

type DataSourceFormValues = z.infer<typeof dataSourceSchema>;

interface DataSource {
  id: string;
  accountName: string;
  bankName: string;
  accountType: 'checking' | 'savings' | 'credit-card' | 'credit' | 'cash' | 'other';
  accountNumber?: string;
  plaidAccessToken?: string;
}

interface DataSourceDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  dataSource?: DataSource | null;
  userId?: string;
}

export function DataSourceDialog({ isOpen, onOpenChange, dataSource, userId }: DataSourceDialogProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [rebuildHistory, setRebuildHistory] = useState(false);
  const [importFrom, setImportFrom] = useState<'thisYear' | 'lastYear'>('lastYear');

  function daysSince(date: Date) {
    const ms = Date.now() - date.getTime();
    return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }

  function getDaysRequested() {
    const now = new Date();
    const year = now.getFullYear();
    const start =
      importFrom === 'thisYear'
        ? new Date(year, 0, 1)
        : new Date(year - 1, 0, 1);

    return daysSince(start);
  }
  
  const isEditMode = !!dataSource;
  const isPlaidAccount = (dataSource as any)?.linkStatus === 'connected' || !!(dataSource as any)?.accessToken;

  const form = useForm<DataSourceFormValues>({
    resolver: zodResolver(dataSourceSchema),
    defaultValues: {
      accountName: '',
      bankName: '',
      accountType: 'checking',
      accountNumber: '',
      importStart: 'lastYear',
    },
  });

  const handlePlaidSuccess = async (public_token: string, metadata: PlaidLinkOnSuccessMetadata) => {
    const activeUserId = userId || user?.uid;
    if (!activeUserId || !firestore) return;
  
    setIsSubmitting(true);
    try {
      // The backend now handles all account creation and updates.
      // We just need to send the public token and user ID.
      await exchangePublicToken({
        publicToken: public_token,
        userId: activeUserId,
      });
  
      toast({ title: "Success", description: "Account connected successfully." });
      onOpenChange(false);
    } catch (error) {
      console.error("Exchange Error:", error);
      toast({ variant: 'destructive', title: 'Connection Failed', description: "Could not finalize the bank link." });
    } finally {
      setIsSubmitting(false);
      setLinkToken(null);
    }
  };

  const { open: openPlaid, ready: isPlaidReady } = usePlaidLink({
    token: linkToken || '', 
    onSuccess: handlePlaidSuccess,
    onExit: () => {
        setLinkToken(null);
        setIsSubmitting(false);
    }
  });

  useEffect(() => {
    if (isPlaidReady && linkToken) {
      openPlaid();
    }
  }, [isPlaidReady, linkToken, openPlaid]);

  const handleContinueToPlaid = async () => {
    const activeUserId = userId || user?.uid;
    if (!activeUserId) return;

    setIsSubmitting(true);
    try {
        const token = await createLinkToken({
          userId: activeUserId,
          accessToken: (dataSource as any)?.plaidAccessToken, // update-mode token (re-link)
          daysRequested: rebuildHistory ? getDaysRequested() : undefined,
        });
        setLinkToken(token);
    } catch (e: any) {
        setIsSubmitting(false);
        toast({ variant: 'destructive', title: 'Plaid Error', description: e.message });
    }
  };

  useEffect(() => {
    if (dataSource) {
      form.reset({
        accountName: dataSource.accountName || '',
        bankName: dataSource.bankName || '',
        accountType: dataSource.accountType || 'checking',
        accountNumber: dataSource.accountNumber || '',
      });
    } else {
      form.reset({ accountName: '', bankName: '', accountType: 'checking', accountNumber: '', importStart: 'lastYear' });
    }
  }, [dataSource, form, isOpen]);

  const onSubmit = async (values: DataSourceFormValues) => {
    const activeUserId = userId || user?.uid;
    if (!activeUserId || !firestore) return;

    setIsSubmitting(true);
    try {
        const bankAccountsCol = collection(firestore, `users/${activeUserId}/bankAccounts`);
        const docRef = isEditMode ? doc(bankAccountsCol, dataSource.id) : doc(bankAccountsCol);
        
        await setDoc(docRef, { ...values, userId: activeUserId }, { merge: true });
        toast({ title: isEditMode ? 'Updated' : 'Added' });
        onOpenChange(false);
    } catch (error) {
        toast({ variant: "destructive", title: "Save Failed" });
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Connection' : 'Connect Account'}</DialogTitle>
          <DialogDescription>
            {isPlaidAccount ? 'Your bank connection needs to be refreshed.' : 'Connect via Plaid or add a manual account.'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3 pt-4">
          {/* Option 1: Re-link only */}
          <Button
            onClick={async () => {
              setRebuildHistory(false);
              await handleContinueToPlaid();
            }}
            className="w-full bg-blue-600 hover:bg-blue-700"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Launching...' : 'Re-link Bank Account'}
          </Button>
        
          {/* Option 2: Re-link + rebuild history */}
          <div className="rounded-lg border p-3 space-y-2">
            <div className="text-sm font-medium">Re-link + Rebuild History</div>
            <div className="text-xs text-muted-foreground">
              Choose how far back to re-import transactions after re-linking.
            </div>
        
            <Select value={importFrom} onValueChange={(v: any) => setImportFrom(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Import starting..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="thisYear">From Jan 1 (this year)</SelectItem>
                <SelectItem value="lastYear">From Jan 1 (last year)</SelectItem>
              </SelectContent>
            </Select>
        
            <Button
              onClick={async () => {
                setRebuildHistory(true);
                await handleContinueToPlaid();
              }}
              className="w-full"
              variant="outline"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Launching...' : 'Re-link + Rebuild'}
            </Button>
          </div>
        </div>

        {!isPlaidAccount && (
          <>
            <div className="flex items-center gap-4 my-2">
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground">OR MANUAL ENTRY</span>
                <Separator className="flex-1" />
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="accountName" render={({ field }) => (
                  <FormItem><FormLabel>Account Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="bankName" render={({ field }) => (
                  <FormItem><FormLabel>Bank Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="accountType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                            <SelectItem value="checking">Checking</SelectItem>
                            <SelectItem value="savings">Savings</SelectItem>
                            <SelectItem value="credit-card">Credit Card</SelectItem>
                            <SelectItem value="cash">Cash</SelectItem>
                        </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                 <FormField
                  control={form.control}
                  name="importStart"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Import Transactions From</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="thisYear">Jan 1 of this year</SelectItem>
                          <SelectItem value="lastYear">Jan 1 of last year</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={isSubmitting} variant="outline" className="w-full">
                    {isSubmitting ? 'Saving...' : 'Save Manual Account'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
