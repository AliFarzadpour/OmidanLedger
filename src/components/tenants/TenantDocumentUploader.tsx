'use client';

import { useState, useRef } from 'react';
import { useUser, useFirestore, useStorage } from '@/firebase';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { doc, collection, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import { Loader2, FileUp, CheckCircle } from 'lucide-react';
import { Textarea } from '../ui/textarea';
import { getAuth } from "firebase/auth";

interface UploaderProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    propertyId: string;
    landlordId: string;
    unitId?: string; // Optional: for unit-level documents
    onSuccess?: () => void;
}

export function TenantDocumentUploader({ isOpen, onOpenChange, propertyId, landlordId, unitId, onSuccess }: UploaderProps) {
    const firestore = useFirestore();
    const storage = useStorage();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [file, setFile] = useState<File | null>(null);
    const [fileType, setFileType] = useState('lease');
    const [description, setDescription] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleUpload = async () => {
      if (!file || !propertyId || !landlordId) {
        toast({
          variant: 'destructive',
          title: 'Missing Information',
          description: 'Please select a file and ensure IDs are set.',
        });
        return;
      }
    
      if (!storage) {
        toast({
          variant: 'destructive',
          title: 'Storage not initialized',
          description:
            'useStorage() returned null/undefined. Check client Firebase init + storageBucket.',
        });
        return;
      }
    
      setIsUploading(true);
      setUploadProgress(0);
    
      try {
        const documentId = uuidv4();
    
        const storagePath = unitId
          ? `property_documents/${propertyId}/units/${unitId}/${documentId}-${file.name}`
          : `property_documents/${propertyId}/${documentId}-${file.name}`;
    
        console.log('[UPLOAD] starting', {
          propertyId,
          unitId,
          landlordId,
          storagePath,
          fileName: file.name,
          size: file.size,
          type: file.type,
        });
    
        const storageRef = ref(storage, storagePath);
    
        const auth = getAuth();
        const u = auth.currentUser;
        console.log("[UPLOAD] auth user", u?.uid, u?.email);

        const token = await u?.getIdToken();
        console.log("[UPLOAD] has token?", !!token);

        const uploadTask = uploadBytesResumable(storageRef, file, {
          customMetadata: { ownerId: landlordId },
        });
    
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(progress);
            console.log('[UPLOAD] progress', Math.round(progress) + '%');
          },
          (error) => {
            console.error('[UPLOAD] storage error:', error);
            toast({
              variant: 'destructive',
              title: 'Upload Failed (Storage)',
              description: error?.message || String(error),
            });
            setIsUploading(false);
          },
          async () => {
            console.log('[UPLOAD] upload complete, fetching download URL...');
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              console.log('[UPLOAD] download URL ok', downloadURL);
    
              const docPath = unitId
                ? `properties/${propertyId}/units/${unitId}/documents`
                : `properties/${propertyId}/documents`;
    
              const docRef = doc(firestore, docPath, documentId);
    
              console.log('[UPLOAD] writing Firestore doc', { docPath, documentId });
    
              await setDoc(docRef, {
                id: documentId,
                propertyId,
                userId: landlordId,
                ...(unitId && { unitId }),
                fileName: file.name,
                fileType,
                description,
                downloadUrl: downloadURL,
                storagePath,
                uploadedAt: serverTimestamp(),
              });
    
              console.log('[UPLOAD] Firestore doc written OK');
    
              toast({ title: 'Upload Complete', description: `${file.name} has been saved.` });
    
              setFile(null);
              setDescription('');
              onOpenChange(false);
              onSuccess?.();
            } catch (err: any) {
              console.error('[UPLOAD] completion error (likely Firestore rules/path):', err);
              toast({
                variant: 'destructive',
                title: 'Upload Failed (Finalize)',
                description: err?.message || String(err),
              });
            } finally {
              setIsUploading(false);
              setUploadProgress(0);
            }
          }
        );
      } catch (err: any) {
        console.error('[UPLOAD] unexpected setup error:', err);
        toast({
          variant: 'destructive',
          title: 'Upload Failed (Setup)',
          description: err?.message || String(err),
        });
        setIsUploading(false);
        setUploadProgress(0);
      }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Upload Document</DialogTitle>
                    <DialogDescription>Add a file to this property's secure document store.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div
                        className="relative flex flex-col items-center justify-center w-full p-6 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <FileUp className="w-10 h-10 text-muted-foreground" />
                        <p className="mt-2 text-sm text-muted-foreground">
                            {file ? `Selected: ${file.name}` : 'Click to select a file'}
                        </p>
                        <Input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            onChange={handleFileSelect}
                        />
                    </div>
                    {isUploading && <Progress value={uploadProgress} className="w-full" />}
                    <div className="grid gap-2">
                        <Label htmlFor="fileType">Document Type</Label>
                        <Select onValueChange={setFileType} defaultValue="lease">
                            <SelectTrigger id="fileType">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="lease">Lease Agreement</SelectItem>
                                <SelectItem value="inspection">Inspection Report</SelectItem>
                                <SelectItem value="deed">Deed / Title</SelectItem>
                                <SelectItem value="credit_report">Credit Report</SelectItem>
                                <SelectItem value="id">Identification</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="description">Description (Optional)</Label>
                        <Textarea
                            id="description"
                            placeholder="e.g., 'Signed lease for Unit B, 2024-2025 term'"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleUpload} disabled={isUploading || !file}>
                        {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                        Upload & Save
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
