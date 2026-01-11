
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
});

type DataSourceFormValues = z.infer<typeof dataSourceSchema>;

interface DataSource {
  id: string;
  accountName: string;
  bankName: string;
  accountType: 'checking' | 'savings' | 'credit-card' | 'cash' | 'credit' | 'other';
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
  
  const isEditMode = !!dataSource;
  const isPlaidAccount = !!dataSource?.plaidAccessToken;

  const form = useForm<DataSourceFormValues>({
    resolver: zodResolver(dataSourceSchema),
    defaultValues: {
      accountName: '',
      bankName: '',
      accountType: 'checking',
      accountNumber: '',
    },
  });

  const handlePlaidSuccess = async (public_token: string, metadata: PlaidLinkOnSuccessMetadata) => {
    const activeUserId = userId || user?.uid;
    if (!activeUserId || !firestore) return;
  
    setIsSubmitting(true);
    try {
      // 0) Ensure we have a bankAccountId (doc id)
      let bankAccountId = dataSource?.id;
  
      // For NEW connections, create a placeholder bank account doc FIRST
      if (!bankAccountId) {
        const bankAccountsCol = collection(firestore, `users/${activeUserId}/bankAccounts`);
        const newRef = doc(bankAccountsCol); // generates id
        bankAccountId = newRef.id;
  
        await setDoc(newRef, {
          userId: activeUserId,
          accountName: metadata.institution?.name || 'Bank Account',
          bankName: metadata.institution?.name || 'Plaid',
          accountType: 'checking',
          linkStatus: 'linking',
          createdAt: serverTimestamp(),
          lastUpdatedAt: serverTimestamp(),
        }, { merge: true });
      }

      // ✅ Save the REAL Plaid account id + details onto this bankAccount doc
      const firstAccount = metadata.accounts?.[0];

      if (firstAccount) {
        const bankAccountRef = doc(firestore, `users/${activeUserId}/bankAccounts/${bankAccountId}`);

        await setDoc(bankAccountRef, {
          bankName: metadata.institution?.name || 'Plaid',
          accountName: firstAccount.name || 'Bank Account',
          accountNumber: firstAccount.mask || '',
          // optional: map subtype to your accountType enums
          accountType: (firstAccount.subtype === 'credit card' || firstAccount.type === 'credit')
            ? 'credit-card'
            : (firstAccount.subtype === 'savings' ? 'savings' : 'checking'),

          // ✅ THIS is the one you need for correct sync filtering
          plaidAccountId: firstAccount.id,

          // helpful for debugging
          plaidInstitutionId: metadata.institution?.institution_id || null,
          lastUpdatedAt: serverTimestamp(),
        }, { merge: true });
      }
  
      // 1) Exchange public_token -> access_token and SAVE it on THIS bank account doc
      await exchangePublicToken({
        publicToken: public_token,
        userId: activeUserId,
        accountId: bankAccountId,
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
        // FIXED: Using single object argument for createLinkToken
        const tokenData = await createLinkToken({ 
            userId: activeUserId,
            accessToken: (dataSource as any)?.accessToken 
        });
        
        // Handle cases where the library might return an object or a direct string
        const token = typeof tokenData === 'string' ? tokenData : (tokenData as any).link_token;
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
      form.reset({ accountName: '', bankName: '', accountType: 'checking', accountNumber: '' });
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
        
        <div className="space-y-4 pt-4">
            <Button 
                onClick={handleContinueToPlaid} 
                className="w-full bg-blue-600 hover:bg-blue-700" 
                disabled={isSubmitting}
            >
                {isSubmitting ? 'Launching...' : isEditMode ? 'Re-link Bank Account' : 'Connect with Plaid'}
            </Button>
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
