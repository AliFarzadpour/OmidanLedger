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
import { useAuth, useFirestore, addDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';

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
}

interface DataSourceDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  dataSource?: DataSource | null;
}

export function DataSourceDialog({ isOpen, onOpenChange, dataSource }: DataSourceDialogProps) {
  const auth = useAuth();
  const firestore = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      form.reset(dataSource);
    } else {
      form.reset({
        accountName: '',
        bankName: '',
        accountType: 'checking',
        accountNumber: '',
      });
    }
  }, [dataSource, form]);

  const onSubmit = async (values: DataSourceFormValues) => {
    if (!auth.currentUser || !firestore) return;

    setIsSubmitting(true);
    
    if (isEditMode && dataSource) {
      const docRef = doc(firestore, `users/${auth.currentUser.uid}/bankAccounts`, dataSource.id);
      const updatedData = { ...dataSource, ...values };
      setDocumentNonBlocking(docRef, updatedData, { merge: true });
    } else {
      const newAccount = {
        ...values,
        userId: auth.currentUser.uid,
      };
      const bankAccountsCol = collection(firestore, `users/${auth.currentUser.uid}/bankAccounts`);
      addDocumentNonBlocking(bankAccountsCol, newAccount);
    }
    
    setIsSubmitting(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Data Source' : 'Add New Data Source'}</DialogTitle>
          <DialogDescription>
            {isEditMode ? 'Update the details for your data source.' : 'Enter the details for your new bank account, credit card, or cash source.'}
          </DialogDescription>
        </DialogHeader>
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
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (isEditMode ? 'Saving...' : 'Adding...') : (isEditMode ? 'Save Changes' : 'Add Account')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
