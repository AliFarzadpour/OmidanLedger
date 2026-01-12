
'use client';

import { useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, writeBatch, deleteDoc, addDoc, where } from 'firebase/firestore';
import { PropertyDashboardSFH } from '@/components/dashboard/properties/PropertyDashboardSFH';
import { Loader2, ArrowLeft, Bot, Building, Plus, Edit, UploadCloud, Eye, Download, Trash2, FileText, BookOpen } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useState, useMemo, useEffect } from 'react';
import { useUser, useStorage } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { deleteObject, ref } from 'firebase/storage';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PropertyForm } from '@/components/dashboard/sales/property-form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TenantDocumentUploader } from '@/components/tenants/TenantDocumentUploader';
import { UnitMatrix } from '@/components/dashboard/sales/UnitMatrix';
import { generateRulesForProperty } from '@/lib/rule-engine';
import { updateUnitsInBulk } from '@/actions/unit-actions';


function AddUnitDialog({ propertyId, onUnitAdded }: { propertyId: string; onUnitAdded: () => void; }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [unitName, setUnitName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleAddNewUnit = async () => {
    if (!user || !firestore || !unitName.trim()) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Unit name cannot be empty.',
      });
      return;
    }
    setIsLoading(true);

    try {
      const unitsCollection = collection(firestore, 'properties', propertyId, 'units');
      await addDoc(unitsCollection, {
        userId: user.uid,
        propertyId: propertyId, // Storing the parent property ID is crucial for collectionGroup queries
        unitNumber: unitName.trim(),
        status: 'vacant',
        createdAt: new Date().toISOString(),
        bedrooms: 0,
        bathrooms: 0,
        sqft: 0,
        amenities: [],
        financials: {
          rent: 0,
          deposit: 0,
        },
      });

      toast({
        title: 'Unit Added',
        description: `Unit "${unitName}" has been successfully created.`,
      });

      onUnitAdded(); // Trigger refetch on parent page
      setUnitName('');
      setIsOpen(false);
    } catch (error: any) {
      console.error('Error adding new unit:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to add the new unit.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Plus className="h-4 w-4" />
          New Unit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a New Unit</DialogTitle>
          <DialogDescription>
            Create a single new unit for this property. You can edit the details later.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-4">
          <Label htmlFor="unit-name">Unit Number or Name</Label>
          <Input
            id="unit-name"
            placeholder="e.g., 204, or Suite B"
            value={unitName}
            onChange={(e) => setUnitName(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button onClick={handleAddNewUnit} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Unit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkOperationsDialog({ propertyId, units }: { propertyId: string, units: any[] }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [newRent, setNewRent] = useState('');

    const handleBulkRentSet = async () => {
        if (!firestore || !units || units.length === 0 || !newRent) return;
        setIsLoading(true);

        const rentValue = Number(newRent);
        const unitIds = units.map(u => u.id);

        try {
            await updateUnitsInBulk(propertyId, unitIds, { 'financials.rent': rentValue });
            toast({ title: "Bulk Update Success", description: `All ${units.length} units set to $${rentValue}` });
            setIsOpen(false);
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Error", description: error.message });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                    <Bot className="h-4 w-4" />
                    Building Operations
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Bulk Building Operations</DialogTitle>
                    <DialogDescription>
                        Apply changes to all units in this building. This action cannot be undone.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="bulk-rent">Set Rent for All Units</Label>
                        <Input 
                            id="bulk-rent" 
                            type="number" 
                            placeholder="e.g., 1500" 
                            value={newRent}
                            onChange={(e) => setNewRent(e.target.value)}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                    <Button onClick={handleBulkRentSet} disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Apply to {units.length} Units
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function PropertyDocuments({ propertyId, landlordId }: { propertyId: string, landlordId: string}) {
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const [isUploaderOpen, setUploaderOpen] = useState(false);

  const docsQuery = useMemoFirebase(() => {
    if (!firestore || !propertyId) return null;
    return query(collection(firestore, `properties/${propertyId}/documents`));
  }, [firestore, propertyId]);

  const { data: documents, isLoading, refetch: refetchDocs } = useCollection(docsQuery);

  const handleDelete = async (docData: any) => {
    if (!firestore || !storage) {
        toast({ variant: 'destructive', title: 'Error', description: 'Firebase services not available.' });
        return;
    }
    if (!docData?.storagePath) {
        toast({ variant: 'destructive', title: 'Cannot Delete', description: 'Document metadata is missing storage path.' });
        return;
    }
    if (!confirm(`Are you sure you want to delete ${docData.fileName}?`)) return;

    try {
        // Delete from Storage
        const fileRef = ref(storage, docData.storagePath);
        await deleteObject(fileRef);

        // Delete from Firestore
        const docRef = doc(firestore, `properties/${propertyId}/documents`, docData.id);
        await deleteDoc(docRef);

        toast({ title: 'Document Deleted', description: `${docData.fileName} has been removed.` });
    } catch (error: any) {
        console.error("Deletion Error:", error);
        toast({ variant: 'destructive', title: 'Deletion Failed', description: error.message });
    }
  };

  const getSafeDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    if (typeof timestamp === 'string') {
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
            return date.toLocaleDateString();
        }
    }
    if (timestamp.seconds) {
      return new Date(timestamp.seconds * 1000).toLocaleDateString();
    }
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleDateString();
    } catch (e) {
      return 'Invalid Date';
    }
  };

  const onUploadSuccess = () => {
    refetchDocs();
    setUploaderOpen(false);
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Document Storage</CardTitle>
            <CardDescription>Lease agreements, inspection reports, and other files for this property.</CardDescription>
          </div>
          <Button size="sm" onClick={() => setUploaderOpen(true)} className="gap-2">
            <UploadCloud className="h-4 w-4" /> Upload File
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading && <p>Loading documents...</p>}
          {!isLoading && (!documents || documents.length === 0) && (
            <div className="text-center py-10 border-2 border-dashed rounded-lg">
                <FileText className="h-10 w-10 mx-auto text-slate-300 mb-2"/>
                <p className="text-sm text-muted-foreground">No documents uploaded for this property yet.</p>
            </div>
          )}
          {!isLoading && documents && documents.length > 0 && (
            <div className="space-y-3">
              {documents.map((doc: any) => (
                <div key={doc.id} className="flex items-start justify-between p-3 bg-slate-50 border rounded-md">
                  <div>
                    <p className="font-medium">{doc.fileName}</p>
                    <p className="text-xs text-muted-foreground mt-1">Type: {doc.fileType} | Uploaded: {getSafeDate(doc.uploadedAt)}</p>
                    {doc.description && <p className="text-sm text-slate-600 mt-2 pl-2 border-l-2 border-slate-200">{doc.description}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <a href={doc.downloadUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="icon" className="h-8 w-8"><Eye className="h-4 w-4"/></Button>
                    </a>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50" onClick={() => handleDelete(doc)}>
                        <Trash2 className="h-4 w-4"/>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      {isUploaderOpen && (
        <TenantDocumentUploader
          isOpen={isUploaderOpen}
          onOpenChange={setUploaderOpen}
          propertyId={propertyId}
          landlordId={landlordId}
          onSuccess={onUploadSuccess}
        />
      )}
    </>
  )
}

export default function PropertyDetailPage() {
  const firestore = useFirestore();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { user } = useUser();
  const { toast } = useToast();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [formTab, setFormTab] = useState('general');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleOpenDialog = (tab: string) => {
    setFormTab(tab);
    setIsEditOpen(true);
  }

  const propertyDocRef = useMemoFirebase(() => {
    if (!firestore || !id || !user) return null;
    return doc(firestore, 'properties', id);
  }, [firestore, id, user, refreshKey]);

  const { data: property, isLoading: isLoadingProperty } = useDoc(propertyDocRef);

  const unitsQuery = useMemoFirebase(() => {
    if (!firestore || !id || !user) return null;
    return query(
        collection(firestore, 'properties', id, 'units'),
        where("userId", "==", user.uid)
    );
  }, [firestore, id, user, refreshKey]);

  const { data: units, isLoading: isLoadingUnits, refetch: refetchUnits } = useCollection(unitsQuery);

  const handleUnitUpdate = () => {
    refetchUnits();
    setRefreshKey(k => k + 1); // This will trigger propertyDocRef to be re-evaluated
  }
  
  // --- EFFECT FOR AUTOMATIC RULE GENERATION ---
  useEffect(() => {
    // Run only when a property is fully loaded and a user exists.
    if (property && user && !isLoadingProperty) {
        // Sanitize the property object to remove any non-serializable fields
        const cleanPropertyData = JSON.parse(JSON.stringify(property));

        generateRulesForProperty(id, cleanPropertyData, user.uid)
            .then(() => {
                // Silently succeed. A toast here would be too noisy.
            })
            .catch((error) => {
                console.error("Auto rule-gen failed:", error);
                toast({
                    variant: 'destructive',
                    title: 'Rule Sync Failed',
                    description: 'Could not automatically update categorization rules.'
                });
            });
    }
  }, [property, user, isLoadingProperty, id, toast]);


  if (isLoadingProperty || isLoadingUnits) {
    return (
      <div className="flex h-full w-full items-center justify-center p-20">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  if (!user) {
    return <div className="p-8">Please log in to view this page.</div>
  }

  // --- THE INTERFACE ROUTER ---
  // If it's a multi-unit or commercial property, show the Central Hub (Unit Matrix)
  if (property?.isMultiUnit || (units && units.length > 0)) {
    return (
        <>
      <div className="space-y-6 p-8">
        <header className="flex justify-between items-end">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/properties')}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                  <h1 className="text-3xl font-bold">{property.name} Central Hub</h1>
                  <p className="text-muted-foreground">{property.address.street}, {property.address.city}</p>
                </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => handleOpenDialog('general')}><Edit className="mr-2 h-4 w-4" /> Edit Settings</Button>
              {units && <BulkOperationsDialog propertyId={id} units={units} />}
              <AddUnitDialog propertyId={id} onUnitAdded={handleUnitUpdate} />
            </div>
        </header>
        
        <Tabs defaultValue="units" className="w-full">
            <TabsList>
                <TabsTrigger value="units">Unit Matrix</TabsTrigger>
                <TabsTrigger value="documents">Building Documents</TabsTrigger>
                <TabsTrigger value="ledger">Property Ledger</TabsTrigger>
            </TabsList>
            <TabsContent value="units" className="mt-6">
                <UnitMatrix propertyId={id} units={units || []} onUpdate={handleUnitUpdate} />
            </TabsContent>
            <TabsContent value="documents" className="mt-6">
                 <PropertyDocuments propertyId={id} landlordId={user.uid} />
            </TabsContent>
            <TabsContent value="ledger" className="mt-6">
                 <Link href={`/dashboard/properties/${id}/transactions`}>
                    <Button>
                        <BookOpen className="mr-2 h-4 w-4" /> Go to Full Ledger
                    </Button>
                 </Link>
            </TabsContent>
        </Tabs>

      </div>

       <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Property Settings</DialogTitle>
            <DialogDescription>
              Update building-level details for {property.name}. Unit-specific details are managed in the unit drawer.
            </DialogDescription>
          </DialogHeader>
          <PropertyForm 
            initialData={{ id: property.id, ...property }} 
            onSuccess={() => { handleUnitUpdate(); setIsEditOpen(false); }} 
            defaultTab={formTab} 
          />
        </DialogContent>
      </Dialog>
      </>
    );
  }

  // Otherwise, return your original Single Family interface
  return <PropertyDashboardSFH property={property} onUpdate={() => setRefreshKey(k => k + 1)} />;
}
