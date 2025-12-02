'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Papa from 'papaparse';
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
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth, useFirestore, addDocumentNonBlocking } from '@/firebase';
import { categorizeTransactions } from '@/ai/flows/categorize-transactions';
import { collection } from 'firebase/firestore';
import { Progress } from '@/components/ui/progress';

const uploadSchema = z.object({
  file: z.instanceof(FileList).refine((files) => files?.length === 1, 'A CSV file is required.'),
});

type UploadFormValues = z.infer<typeof uploadSchema>;

interface DataSource {
  id: string;
  accountName: string;
}

interface UploadTransactionsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  dataSource: DataSource;
}

export function UploadTransactionsDialog({ isOpen, onOpenChange, dataSource }: UploadTransactionsDialogProps) {
  const { user } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const form = useForm<UploadFormValues>({
    resolver: zodResolver(uploadSchema),
  });

  const onSubmit = async (values: UploadFormValues) => {
    if (!user || !firestore) return;
    setIsUploading(true);
    setUploadProgress(0);

    const file = values.file[0];

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const transactions = results.data as { Date: string; Description: string; Amount: string }[];
        const transactionsCol = collection(firestore, `users/${user.uid}/bankAccounts/${dataSource.id}/transactions`);
        
        let processedCount = 0;

        for (const record of transactions) {
          try {
            // Basic validation
            if (!record.Date || !record.Description || !record.Amount) continue;

            const amount = parseFloat(record.Amount);
            if (isNaN(amount)) continue;

            // AI Categorization
            const categorization = await categorizeTransactions({
              transactionDescription: record.Description,
            });

            const newTransaction = {
              date: new Date(record.Date).toISOString(),
              description: record.Description,
              amount: amount,
              category: categorization.category || 'Other',
              bankAccountId: dataSource.id,
              userId: user.uid,
            };

            addDocumentNonBlocking(transactionsCol, newTransaction);

          } catch (error) {
            console.error("Error processing transaction:", error);
          }
          processedCount++;
          setUploadProgress((processedCount / transactions.length) * 100);
        }
        
        toast({
          title: 'Upload Complete',
          description: `${processedCount} transactions have been successfully imported and categorized.`,
        });
        setIsUploading(false);
        onOpenChange(false);
        form.reset();
      },
      error: (error) => {
        toast({
          variant: 'destructive',
          title: 'Upload Failed',
          description: `An error occurred while parsing the CSV file: ${error.message}`,
        });
        setIsUploading(false);
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!isUploading) {
        onOpenChange(open);
        form.reset();
      }
    }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Transaction Statement</DialogTitle>
          <DialogDescription>
            Select a CSV file to upload for the account: <strong>{dataSource.accountName}</strong>.
            The CSV should have 'Date', 'Description', and 'Amount' columns.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="file"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CSV File</FormLabel>
                  <FormControl>
                    <Input 
                      type="file" 
                      accept=".csv"
                      disabled={isUploading}
                      {...form.register('file')}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {isUploading && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Categorizing and importing transactions...</p>
                <Progress value={uploadProgress} />
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isUploading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isUploading}>
                {isUploading ? 'Uploading...' : 'Upload & Categorize'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
