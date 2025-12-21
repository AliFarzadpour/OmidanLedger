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

interface UploaderProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    propertyId: string;
    landlordId: string;
    onSuccess?: () => void;
}

export function TenantDocumentUploader({ isOpen, onOpenChange, propertyId, landlordId, onSuccess }: UploaderProps) {
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
            toast({ variant: 'destructive', title: 'Missing Information', description: 'Please select a file and ensure IDs are set.' });
            return;
        }
        setIsUploading(true);

        const documentId = uuidv4();
        const storagePath = `property_documents/${propertyId}/${documentId}-${file.name}`;
        const storageRef = ref(storage, storagePath);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setUploadProgress(progress);
            },
            (error) => {
                console.error("Upload error:", error);
                toast({ variant: 'destructive', title: 'Upload Failed', description: error.message });
                setIsUploading(false);
            },
            async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                const docRef = doc(firestore, `properties/${propertyId}/documents`, documentId);

                await setDoc(docRef, {
                    id: documentId,
                    propertyId: propertyId,
                    userId: landlordId,
                    fileName: file.name,
                    fileType: fileType,
                    description: description,
                    downloadUrl: downloadURL,
                    storagePath: storagePath,
                    uploadedAt: serverTimestamp()
                });

                toast({ title: 'Upload Complete', description: `${file.name} has been saved.` });
                setIsUploading(false);
                setFile(null);
                setDescription('');
                onOpenChange(false);
                if (onSuccess) onSuccess();
            }
        );
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
