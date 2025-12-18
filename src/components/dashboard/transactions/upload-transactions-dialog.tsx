'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Upload, FileText, Check, AlertCircle, Loader2 } from 'lucide-react';

// We define a simple interface for our preview data so we don't rely on complex types
interface TransactionPreview {
  date: string;
  description: string;
  amount: string;
}

export function UploadTransactionsDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [previewData, setPreviewData] = useState<TransactionPreview[]>([]);

  // Handle file selection safely
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setFileName(file.name);
    setError('');
    setLoading(true);

    // Basic CSV parsing for preview
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n').slice(0, 5); // Preview first 5 lines
        
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
      } catch (err) {
        console.error("Error reading file:", err);
        setError("Failed to read file.");
      } finally {
        setLoading(false);
      }
    };
    
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    setLoading(true);
    // TODO: Connect to your backend import logic here
    setTimeout(() => {
        setLoading(false);
        setOpen(false);
        setFileName('');
        setPreviewData([]);
        alert("Upload feature coming soon!");
    }, 1000);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="h-4 w-4" />
          Upload CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Upload Transactions</DialogTitle>
          <DialogDescription>
            Upload a CSV file from your bank. Expected format: Date, Description, Amount.
          </DialogDescription>
        </DialogHeader>

        {!fileName ? (
          <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 mt-4 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer relative">
            {/* Input must handle onChange, not onClick */}
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

             {/* Preview */}
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
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleUpload} disabled={!fileName || loading} className="bg-blue-600 hover:bg-blue-700">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : null}
            Upload File
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
