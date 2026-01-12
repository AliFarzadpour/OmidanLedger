
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
import { createLinkToken, exchangePublicToken } from '@/lib/plaid';
import { useToast } from '@/hooks/use-toast';
import { PlaidLinkOnSuccessMetadata, usePlaidLink } from 'react-plaid-link';

const dataSourceSchema = z.object({
  accountName: z.string().min(1, 'Account name is required.'),
  bankName: z.string().min(1, 'Bank name is required.'),
  accountType: z.enum(['checking', 'savings', 'credit-card', 'cash', 'credit', 'other']),
  accountNumber: z.string().optional(),
  importStart: z.enum(['thisYear', 'lastYear', 'allTime']).default('lastYear'),
});

type DataSourceFormValues = z.infer<typeof dataSourceSchema>;

interface DataSource {
  id: string;
  accountName: string;
  bankName: string;
  accountType: 'checking' | 'savings' | 'credit-card' | 'credit' | 'cash' | 'other';
  accountNumber?: string;
  plaidAccessToken?: string;
  accessToken?: string;
  plaidAccountId?: string;
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
  
  const importStartValue = form.watch('importStart');

  const handlePlaidSuccess = async (public_token: string, metadata: PlaidLinkOnSuccessMetadata) => {
    const activeUserId = userId || user?.uid;
    if (!activeUserId) return;
  
    setIsSubmitting(true);
  
    try {
      await exchangePublicToken({
        publicToken: public_token,
        userId: activeUserId,
        metadata: metadata, // Pass metadata here
      });
  
      toast({ title: isEditMode ? "Re-linked Successfully" : "Connected", description: "Account data is being refreshed." });
      onOpenChange(false);
    } catch (error: any) {
      console.error("Plaid Success Error:", error);
      toast({
        variant: "destructive",
        title: "Connection Failed",
        description: "Could not finalize the bank link.",
      });
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
        const daysRequested = importStartValue === 'thisYear' ? 365 : importStartValue === 'lastYear' ? 730 : 730;
        const token = await createLinkToken({
          userId: activeUserId,
          accessToken: isEditMode ? (dataSource as any)?.plaidAccessToken : undefined,
          daysRequested,
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
        
        <Form {...form}>
          <div className="space-y-3 pt-4">
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
                        <SelectItem value="allTime">All available time</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            <Button
              onClick={handleContinueToPlaid}
              className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Launching...' : isEditMode ? 'Re-link with Plaid' : 'Connect with Plaid'}
            </Button>
          </div>

          {!isPlaidAccount && !isEditMode && (
            <>
              <div className="flex items-center gap-4 my-2">
                  <Separator className="flex-1" />
                  <span className="text-xs text-muted-foreground">OR MANUAL ENTRY</span>
                  <Separator className="flex-1" />
              </div>

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
                <DialogFooter>
                  <Button type="submit" disabled={isSubmitting} variant="outline" className="w-full">
                    {isSubmitting ? 'Saving...' : 'Save Manual Account'}
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </Form>
      </DialogContent>
    </Dialog>
  );
}
