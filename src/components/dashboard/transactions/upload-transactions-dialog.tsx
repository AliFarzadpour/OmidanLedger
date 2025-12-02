'use client';

import { useState } from 'react';
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
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, addDocumentNonBlocking } from '@/firebase';
import { categorizeTransactionsFromStatement } from '@/ai/flows/categorize-transactions-from-statement';
import { collection } from 'firebase/firestore';
import { Progress } from '@/components/ui/progress';

const uploadSchema = z.object({
  file: z.instanceof(FileList).refine((files) => files?.length === 1, 'A CSV or PDF file is required.'),
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

const fileToDataUri = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

export function UploadTransactionsDialog({ isOpen, onOpenChange, dataSource }: UploadTransactionsDialogProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const form = useForm<UploadFormValues>({
    resolver: zodResolver(uploadSchema),
  });

  const onSubmit = async (values: UploadFormValues) => {
    if (!user || !firestore) return;
    
    const file = values.file[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
        const dataUri = await fileToDataUri(file);
        
        toast({
            title: 'Processing Statement',
            description: 'The AI is analyzing your document. This may take a moment...',
        });

        // AI Categorization from the entire statement
        const result = await categorizeTransactionsFromStatement({
          statementDataUri: dataUri,
        });

        if (!result || !result.transactions || result.transactions.length === 0) {
            throw new Error("The AI could not find any transactions in the document.");
        }

        const transactionsCol = collection(firestore, `users/${user.uid}/bankAccounts/${dataSource.id}/transactions`);
        const totalTransactions = result.transactions.length;
        let processedCount = 0;

        for (const transaction of result.transactions) {
            const newTransaction = {
                ...transaction,
                bankAccountId: dataSource.id,
                userId: user.uid,
            };
            addDocumentNonBlocking(transactionsCol, newTransaction);
            processedCount++;
            setUploadProgress((processedCount / totalTransactions) * 100);
        }
        
        toast({
          title: 'Upload Complete',
          description: `${processedCount} transactions have been successfully imported and categorized.`,
        });

    } catch (error: any) {
        console.error("Error processing statement:", error);
        toast({
          variant: 'destructive',
          title: 'Processing Failed',
          description: error.message || 'An unexpected error occurred while processing the statement.',
        });
    } finally {
        setIsUploading(false);
        onOpenChange(false);
        form.reset();
    }
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
            Select a CSV or PDF file to upload for the account: <strong>{dataSource.accountName}</strong>.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="file"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Statement File</FormLabel>
                  <FormControl>
                    <Input 
                      type="file" 
                      accept=".csv,.pdf"
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
                {isUploading ? 'Processing...' : 'Upload & Categorize'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
