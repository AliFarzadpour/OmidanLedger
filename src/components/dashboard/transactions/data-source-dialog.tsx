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
import { collection, doc, addDoc, setDoc } from 'firebase/firestore';
import { Separator } from '@/components/ui/separator';
import { createBankAccountFromPlaid, exchangePublicToken, createLinkToken } from '@/lib/plaid';
import { useToast } from '@/hooks/use-toast';
import { PlaidLinkOnSuccess, PlaidLinkOnSuccessMetadata, usePlaidLink } from 'react-plaid-link';
import { Label } from '@/components/ui/label';

const dataSourceSchema = z.object({
  accountName: z.string().min(1, 'Account name is required.'),
  bankName: z.string().min(1, 'Bank name is required.'),
  accountType: z.enum(['checking', 'savings', 'credit-card', 'cash']),
  accountNumber: z.string().optional(),
});

type DataSourceFormValues = z.infer<typeof dataSourceSchema>;

interface DataSource {
  id: string;
  accountName: string;
  bankName: string;
  accountType: 'checking' | 'savings' | 'credit-card' | 'cash';
  accountNumber?: string;
  plaidAccessToken?: string;
}

interface DataSourceDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  dataSource?: DataSource | null;
}

export function DataSourceDialog({ isOpen, onOpenChange, dataSource }: DataSourceDialogProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  
  const getDefaultDate = () => {
    const date = new Date();
    date.setMonth(0); // January
    date.setDate(1);  // 1st
    return date.toISOString().split('T')[0]; // Format: "YYYY-MM-DD"
  };

  const [startDate, setStartDate] = useState(getDefaultDate());

  const isEditMode = !!dataSource;

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
    if (!user) return;

    setIsSubmitting(true);
    
    toast({
      title: 'Connecting Account...',
      description: 'Exchanging token and setting up your account. Please wait.',
    });

    try {
      const { accessToken } = await exchangePublicToken({ publicToken: public_token });
      
      await createBankAccountFromPlaid({
        userId: user.uid,
        accessToken: accessToken,
        metadata: metadata,
      });

      toast({
        title: "Bank Connected Successfully!",
        description: "We are downloading your history. The last 30 days are ready now. The rest will appear automatically in about 5-10 minutes.",
        duration: 8000,
      });

    } catch (error) {
      console.error('Plaid connection error:', error);
      toast({
        variant: 'destructive',
        title: 'Plaid Connection Failed',
        description: 'There was an error connecting your bank account. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
      onOpenChange(false);
    }
  };

  const { open: openPlaid, ready: isPlaidReady } = usePlaidLink({
    token: linkToken,
    onSuccess: handlePlaidSuccess,
  });

  useEffect(() => {
    if (isPlaidReady && linkToken) {
      openPlaid();
    }
  }, [isPlaidReady, linkToken, openPlaid]);

  const handleContinueToPlaid = async () => {
    if (!user) return;
    
    const start = new Date(startDate);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - start.getTime());
    let calculatedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
    if (calculatedDays < 30) calculatedDays = 30;
    if (calculatedDays > 730) calculatedDays = 730;

    onOpenChange(false); // Close the dialog first

    try {
        const token = await createLinkToken({ userId: user.uid, daysRequested: calculatedDays });
        setLinkToken(token);
    } catch (e: any) {
        toast({
            variant: 'destructive',
            title: 'Plaid Setup Incomplete',
            description: e.message || 'Could not create Plaid link token. Please check your .env file.',
        });
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
      form.reset({
        accountName: '',
        bankName: '',
        accountType: 'checking',
        accountNumber: '',
      });
    }
  }, [dataSource, form]);

  useEffect(() => {
    if (!isOpen) {
        setStartDate(getDefaultDate());
        setLinkToken(null); // Reset link token when dialog closes
    }
  }, [isOpen]);

  const onSubmit = async (values: DataSourceFormValues) => {
    if (!user || !firestore) return;

    setIsSubmitting(true);
    
    try {
        if (isEditMode && dataSource) {
            const docRef = doc(firestore, `users/${user.uid}/bankAccounts`, dataSource.id);
            const updatedData = { ...dataSource, ...values };
            await setDoc(docRef, updatedData, { merge: true });
        } else {
            const newAccount = {
                ...values,
                userId: user.uid,
            };
            const bankAccountsCol = collection(firestore, `users/${user.uid}/bankAccounts`);
            await addDoc(bankAccountsCol, newAccount);
        }
        toast({
            title: isEditMode ? 'Data Source Updated' : 'Data Source Added',
            description: `${values.accountName} has been saved.`,
        });
        onOpenChange(false);
    } catch (error) {
        console.error("Error saving data source:", error);
        toast({
            variant: "destructive",
            title: "Error",
            description: "Could not save data source.",
        });
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Data Source' : 'Add New Data Source'}</DialogTitle>
          <DialogDescription>
             Connect to thousands of banks with Plaid or add a manual account.
          </DialogDescription>
        </DialogHeader>
        
        {isEditMode && dataSource?.plaidAccessToken ? (
          <p className="text-sm text-center text-muted-foreground p-4 bg-muted rounded-md">
            Editing for Plaid-linked accounts is limited. To change account details, please re-link the account.
          </p>
        ) : (
          <>
            <div className="space-y-4 pt-4">
                 <div className="space-y-2">
                    <Label>Sync Start Date</Label>
                    <Input 
                        type="date" 
                        value={startDate} 
                        onChange={(e) => setStartDate(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Select how far back you want to download transactions (max 2 years).</p>
                </div>
                <Button onClick={handleContinueToPlaid} className="w-full">Continue to Bank Login</Button>
            </div>
            
            <div className="flex items-center gap-4">
                <Separator className="flex-1" />
                <span className="text-sm text-muted-foreground">OR</span>
                <Separator className="flex-1" />
            </div>

            <p className="text-sm text-muted-foreground text-center -mt-2">Add a manual data source for cash or other offline accounts.</p>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="accountName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Personal Checking" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="bankName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bank/Source Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Chase Bank or 'My Wallet'" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="accountType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select an account type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="checking">Checking</SelectItem>
                          <SelectItem value="savings">Savings</SelectItem>
                          <SelectItem value="credit-card">Credit Card</SelectItem>
                          <SelectItem value="cash">Cash</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="accountNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Number (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Last 4 digits" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={isSubmitting}>
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
