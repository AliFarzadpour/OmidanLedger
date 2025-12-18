'use client';

import { useState } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { writeBatch, collection, doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Upload, FileText, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { categorizeTransactionsFromStatement } from '@/ai/flows/categorize-transactions-from-statement';
import { v4 as uuidv4 } from 'uuid';

interface DataSource {
  id: string;
  accountName: string;
}

interface UploadTransactionsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  dataSource: DataSource;
}

interface TransactionPreview {
  date: string;
  description: string;
  amount: string;
}

export function UploadTransactionsDialog({ isOpen, onOpenChange, dataSource }: UploadTransactionsDialogProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [previewData, setPreviewData] = useState<TransactionPreview[]>([]);
  const [fileDataUri, setFileDataUri] = useState<string | null>(null);

  const resetState = () => {
    setLoading(false);
    setFileName('');
    setError('');
    setPreviewData([]);
    setFileDataUri(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    resetState();
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setFileName(file.name);
    setLoading(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const result = event.target?.result as string;
        setFileDataUri(result);

        // For preview, we read the text content
        const textReader = new FileReader();
        textReader.onload = (textEvent) => {
          const text = textEvent.target?.result as string;
          const lines = text.split('\n').slice(0, 5);
          
          const preview: TransactionPreview[] = lines
            .filter(line => line.trim().length > 0)
            .map(line => {
              const cols = line.split(',');
              return {
                date: cols[0] || 'Unknown',
                description: cols[1] || 'Unknown',
                amount: cols[2] || '0.00'
              };
            });
          
          setPreviewData(preview);
          setLoading(false);
        };
        textReader.readAsText(file);

      } catch (err) {
        console.error("Error reading file:", err);
        setError("Failed to read file.");
        setLoading(false);
      }
    };
    
    // Read the file as a Data URI for the AI flow
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!fileDataUri || !user || !firestore) {
      setError("File data or user session is missing.");
      return;
    }
    setLoading(true);
    setError('');
    
    try {
      // 1. Call the AI Flow to categorize transactions
      toast({ title: "AI is analyzing...", description: "Categorizing transactions from your statement." });
      const result = await categorizeTransactionsFromStatement({
        statementDataUri: fileDataUri,
        userId: user.uid,
      });

      if (!result.transactions || result.transactions.length === 0) {
        throw new Error("The AI could not find any transactions in the file.");
      }

      // 2. Save the categorized transactions to Firestore
      const batch = writeBatch(firestore);
      const transactionsColRef = collection(firestore, `users/${user.uid}/bankAccounts/${dataSource.id}/transactions`);

      result.transactions.forEach(tx => {
        const docRef = doc(transactionsColRef, uuidv4());
        batch.set(docRef, {
          ...tx,
          userId: user.uid, // Ensure denormalized userId is present
          bankAccountId: dataSource.id,
          createdAt: new Date().toISOString()
        });
      });

      await batch.commit();

      toast({
        title: "Upload Successful",
        description: `${result.transactions.length} transactions have been imported and categorized.`,
      });

      onOpenChange(false); // Close dialog on success
      resetState();
      
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unknown error occurred during upload.");
      toast({ variant: 'destructive', title: "Upload Failed", description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { onOpenChange(open); if (!open) resetState(); }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Upload Transactions for {dataSource.accountName}</DialogTitle>
          <DialogDescription>
            Upload a CSV file from your bank. Expected format: Date, Description, Amount.
          </DialogDescription>
        </DialogHeader>

        {!fileName ? (
          <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 mt-4 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer relative">
            <input 
              type="file" 
              accept=".csv" 
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <FileText className="h-8 w-8 text-slate-400 mb-2" />
            <p className="text-sm font-medium text-slate-900">
              {loading ? "Reading..." : "Click to upload CSV"}
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
             <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-md text-sm">
                <Check className="h-4 w-4" />
                Selected: <b>{fileName}</b>
             </div>

             {previewData.length > 0 && (
                <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="p-2">Date</th>
                                <th className="p-2">Description</th>
                                <th className="p-2 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {previewData.map((row, i) => (
                                <tr key={i} className="border-t">
                                    <td className="p-2">{row.date}</td>
                                    <td className="p-2">{row.description}</td>
                                    <td className="p-2 text-right">{row.amount}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
             )}
          </div>
        )}

        {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-md text-sm mt-2">
            <AlertCircle className="h-4 w-4" />
            {error}
            </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleUpload} disabled={!fileName || loading} className="bg-blue-600 hover:bg-blue-700">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : null}
            Import & Categorize
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
