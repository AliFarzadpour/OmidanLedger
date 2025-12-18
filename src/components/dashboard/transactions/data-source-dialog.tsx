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
import { PlaidLink } from './plaid-link';
import { Separator } from '@/components/ui/separator';
import { createBankAccountFromPlaid, exchangePublicToken } from '@/lib/plaid';
import { useToast } from '@/hooks/use-toast';
import { PlaidLinkOnSuccessMetadata } from 'react-plaid-link';

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

  const [currentStep, setCurrentStep] = useState(1);
  
  const getDefaultDate = () => {
    const date = new Date();
    date.setMonth(0); // January
    date.setDate(1);  // 1st
    return date.toISOString().split('T')[0]; // Format: "YYYY-MM-DD"
  };

  const [startDate, setStartDate] = useState(getDefaultDate());
  const [daysToRequest, setDaysToRequest] = useState(90);

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
        setCurrentStep(1);
        setStartDate(getDefaultDate());
    }
  }, [isOpen]);

  const handleContinueToPlaid = () => {
    const start = new Date(startDate);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - start.getTime());
    let calculatedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
    if (calculatedDays < 30) calculatedDays = 30;
    if (calculatedDays > 730) calculatedDays = 730;

    setDaysToRequest(calculatedDays);
    setCurrentStep(2); // Move to Plaid step
  };


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
  
  const handlePlaidSuccess = async (public_token: string, metadata: PlaidLinkOnSuccessMetadata) => {
    if (!user) return;

    setIsSubmitting(true);
    onOpenChange(false);

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
        title: 'Account Connected!',
        description: `${metadata.institution.name} has been successfully linked.`,
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
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange} modal={false}>
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
            {currentStep === 1 && (
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
            )}

            {currentStep === 2 && (
                <PlaidLink 
                    onSuccess={handlePlaidSuccess}
                    daysRequested={daysToRequest}
                />
            )}
            
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