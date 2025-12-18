'use client';

import { useState } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { writeBatch, doc, collection, serverTimestamp } from 'firebase/firestore';
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
import { Upload, FileSpreadsheet, Check, AlertCircle, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';

export function ImportPropertiesDialog() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');

  // 1. Handle File Upload & Parsing
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError('');
    setLoading(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        
        // Get the first worksheet
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        // Convert to JSON
        const data = XLSX.utils.sheet_to_json(ws);
        
        // Validate / Map Data
        // We look for columns like "Name", "Address", "Rent"
        const mapped = data.map((row: any) => ({
          name: row['Name'] || row['Property'] || row['Nickname'] || 'Unnamed Property',
          address: row['Address'] || row['Location'] || '',
          rentAmount: row['Rent'] || row['Amount'] || 0,
          status: row['Status'] || 'Occupied',
          type: row['Type'] || 'Single Family'
        }));

        setPreviewData(mapped);
      } catch (err) {
        console.error(err);
        setError("Could not read file. Make sure it's a standard Excel or CSV.");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  // 2. Batch Save to Firestore
  const handleImport = async () => {
    if (!user || !firestore) return;
    setLoading(true);

    try {
      const batch = writeBatch(firestore);
      
      previewData.forEach((prop) => {
        const newRef = doc(collection(firestore, 'properties'));
        batch.set(newRef, {
          id: newRef.id,
          userId: user.uid,
          name: prop.name,
          address: { street: prop.address }, // Simplified address for now
          financials: {
            targetRent: parseFloat(prop.rentAmount) || 0,
          },
          status: prop.status,
          type: prop.type,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      await batch.commit();
      
      setOpen(false);
      setPreviewData([]);
      setFileName('');
      // Force a refresh via router if needed, or rely on real-time listeners
      window.location.reload(); 

    } catch (err) {
      console.error(err);
      setError("Failed to save properties to database.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="h-4 w-4" />
          Import from Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Import Properties</DialogTitle>
          <DialogDescription>
            Upload your rent roll or property list (Excel/CSV). <br/>
            Expected columns: <b>Name, Address, Rent, Status</b>.
          </DialogDescription>
        </DialogHeader>

        {!previewData.length ? (
          <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-10 mt-4 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer relative">
            <input 
              type="file" 
              accept=".xlsx, .xls, .csv" 
              onChange={handleFileUpload}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <FileSpreadsheet className="h-10 w-10 text-slate-400 mb-2" />
            <p className="text-sm font-medium text-slate-900">
              {loading ? "Reading file..." : "Click to upload spreadsheet"}
            </p>
            <p className="text-xs text-slate-500 mt-1">.XLSX or .CSV files</p>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
             <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-md text-sm">
                <Check className="h-4 w-4" />
                Found <b>{previewData.length}</b> properties in {fileName}
             </div>
             
             {/* Simple Preview Table */}
             <div className="max-h-[200px] overflow-auto border rounded-md">
               <table className="w-full text-xs text-left">
                 <thead className="bg-slate-50 sticky top-0">
                   <tr>
                     <th className="p-2 border-b">Name</th>
                     <th className="p-2 border-b">Address</th>
                     <th className="p-2 border-b text-right">Rent</th>
                   </tr>
                 </thead>
                 <tbody>
                   {previewData.map((row, i) => (
                     <tr key={i} className="border-b last:border-0">
                       <td className="p-2 truncate max-w-[150px]">{row.name}</td>
                       <td className="p-2 truncate max-w-[200px]">{row.address}</td>
                       <td className="p-2 text-right">${row.rentAmount}</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-md text-sm mt-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => { setPreviewData([]); setFileName(''); }}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!previewData.length || loading} className="bg-blue-600 hover:bg-blue-700">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : null}
            Import {previewData.length} Properties
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
