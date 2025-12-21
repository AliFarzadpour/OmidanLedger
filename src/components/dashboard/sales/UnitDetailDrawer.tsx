
'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { doc, updateDoc, collection, query, deleteDoc } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { useFieldArray, useForm } from 'react-hook-form';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Hash, Users, Plus, Trash2, FileText, UploadCloud, Eye, Download } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { TenantDocumentUploader } from '@/components/tenants/TenantDocumentUploader';
import { useStorage } from '@/firebase';
import { ref, deleteObject } from 'firebase/storage';

function UnitDocuments({ propertyId, unitId, landlordId }: { propertyId: string; unitId: string; landlordId: string }) {
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const [isUploaderOpen, setUploaderOpen] = useState(false);

  const docsQuery = useMemoFirebase(() => {
    if (!firestore || !propertyId || !unitId) return null;
    return query(collection(firestore, `properties/${propertyId}/units/${unitId}/documents`));
  }, [firestore, propertyId, unitId]);

  const { data: documents, isLoading, refetch: refetchDocs } = useCollection(docsQuery);

  const handleDelete = async (docData: any) => {
    if (!firestore || !storage || !docData?.storagePath) {
      toast({ variant: 'destructive', title: 'Error', description: 'Cannot delete document due to missing information.' });
      return;
    }
    if (!confirm(`Are you sure you want to delete ${docData.fileName}?`)) return;

    try {
      await deleteObject(ref(storage, docData.storagePath));
      await deleteDoc(doc(firestore, `properties/${propertyId}/units/${unitId}/documents`, docData.id));
      toast({ title: 'Document Deleted' });
    } catch (error: any) {
      console.error("Deletion Error:", error);
      toast({ variant: 'destructive', title: 'Deletion Failed', description: error.message });
    }
  };

  const getSafeDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    if (timestamp.seconds) return new Date(timestamp.seconds * 1000).toLocaleDateString();
    try {
      const date = new Date(timestamp);
      return isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleDateString();
    } catch { return 'Invalid Date'; }
  };
  
  return (
    <>
      <div className="space-y-3">
        <Button size="sm" variant="outline" onClick={() => setUploaderOpen(true)} className="w-full gap-2 border-dashed">
          <UploadCloud className="h-4 w-4" /> Upload Document to Unit
        </Button>
        {isLoading && <p className="text-xs text-center text-muted-foreground">Loading documents...</p>}
        {!isLoading && (!documents || documents.length === 0) && (
          <p className="text-xs text-center text-muted-foreground py-2">No documents for this unit.</p>
        )}
        <div className="space-y-2">
          {documents?.map((doc: any) => (
            <div key={doc.id} className="flex items-center justify-between p-2 bg-slate-100 border rounded-md">
              <div className="flex items-center gap-2">
                 <FileText className="h-4 w-4 text-slate-500"/>
                 <div>
                    <p className="text-sm font-medium">{doc.fileName}</p>
                    <p className="text-xs text-muted-foreground">{getSafeDate(doc.uploadedAt)}</p>
                 </div>
              </div>
              <div className="flex items-center gap-1">
                <a href={doc.downloadUrl} target="_blank" rel="noopener noreferrer"><Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="h-4 w-4"/></Button></a>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-500" onClick={() => handleDelete(doc)}><Trash2 className="h-4 w-4"/></Button>
              </div>
            </div>
          ))}
        </div>
      </div>
      {isUploaderOpen && (
        <TenantDocumentUploader
          isOpen={isUploaderOpen}
          onOpenChange={setUploaderOpen}
          propertyId={propertyId}
          unitId={unitId} // Pass unit ID
          landlordId={landlordId}
          onSuccess={() => refetchDocs()}
        />
      )}
    </>
  );
}


export function UnitDetailDrawer({ propertyId, unit, isOpen, onOpenChange, onUpdate }: any) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const addTenantButtonRef = useRef<HTMLButtonElement>(null);
  const {user} = useUser();

  const { register, control, handleSubmit, getValues, reset } = useForm({
    defaultValues: {
      unitNumber: unit?.unitNumber || '',
      bedrooms: unit?.bedrooms || 0,
      bathrooms: unit?.bathrooms || 0,
      sqft: unit?.sqft || 0,
      targetRent: unit?.financials?.rent || 0,
      securityDeposit: unit?.financials?.deposit || 0,
      tenants: unit?.tenants || []
    }
  });
  
  useEffect(() => {
    if (unit) {
      reset({
        unitNumber: unit.unitNumber || '',
        bedrooms: unit.bedrooms || 0,
        bathrooms: unit.bathrooms || 0,
        sqft: unit.sqft || 0,
        targetRent: unit.financials?.rent || 0,
        securityDeposit: unit.financials?.deposit || 0,
        tenants: unit.tenants || []
      });
    }
  }, [unit, reset]);


  const { fields, append, remove } = useFieldArray({
    control,
    name: "tenants"
  });

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        addTenantButtonRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const onSubmit = async (data: any) => {
    if (!firestore || !unit) return;
    setIsSaving(true);

    const unitRef = doc(firestore, 'properties', propertyId, 'units', unit.id);

    try {
      await updateDoc(unitRef, {
        unitNumber: data.unitNumber,
        bedrooms: Number(data.bedrooms),
        bathrooms: Number(data.bathrooms),
        sqft: Number(data.sqft),
        'financials.rent': Number(data.targetRent),
        'financials.deposit': Number(data.securityDeposit),
        tenants: data.tenants
      });
      
      toast({ title: "Success", description: "Unit identity and details updated." });
      if (onUpdate) onUpdate();
      onOpenChange(false);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent key={unit?.id} className="sm:max-w-[550px] overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-3">
             <Input
                id="unitNumber"
                {...register('unitNumber')}
                className="w-28 h-11 text-xl font-bold border-2 focus:border-blue-500"
              />
            <SheetTitle className="text-2xl font-black text-slate-900">
              Unit Management
            </SheetTitle>
          </div>
        </SheetHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pt-6">
          <Accordion type="multiple" defaultValue={['tenants', 'specs']}>
            
            <AccordionItem value="tenants">
              <AccordionTrigger className="text-lg font-semibold"><Users className="mr-2 h-5 w-5 text-slate-500" /> Tenants & Lease</AccordionTrigger>
              <AccordionContent className="pt-2">
                <div className="space-y-4">
                    {fields.map((field, index) => (
                        <div key={field.id} className="p-4 bg-slate-50 rounded-lg border space-y-3 relative">
                            <Button 
                                type="button" 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => remove(index)}
                                className="absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1"><Label className="text-xs">First Name</Label><Input {...register(`tenants.${index}.firstName`)} /></div>
                                <div className="space-y-1"><Label className="text-xs">Last Name</Label><Input {...register(`tenants.${index}.lastName`)} /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1"><Label className="text-xs">Email</Label><Input type="email" {...register(`tenants.${index}.email`)} /></div>
                                <div className="space-y-1"><Label className="text-xs">Phone</Label><Input {...register(`tenants.${index}.phone`)} /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                                <div className="space-y-1"><Label className="text-xs">Lease Start</Label><Input type="date" {...register(`tenants.${index}.leaseStart`)} /></div>
                                <div className="space-y-1"><Label className="text-xs">Lease End</Label><Input type="date" {...register(`tenants.${index}.leaseEnd`)} /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1"><Label className="text-xs">Rent Amount ($)</Label><Input type="number" {...register(`tenants.${index}.rentAmount`)} /></div>
                                <div className="space-y-1"><Label className="text-xs">Deposit Held ($)</Label><Input type="number" {...register(`tenants.${index}.deposit`)} /></div>
                            </div>
                        </div>
                    ))}
                    <Button 
                      ref={addTenantButtonRef}
                      type="button" 
                      variant="outline" 
                      className="w-full border-dashed"
                      onClick={() => append({ firstName: '', lastName: '', email: '', phone: '', leaseStart: '', leaseEnd: '', rentAmount: getValues('targetRent') || 0, deposit: getValues('securityDeposit') || 0 })}
                    >
                        <Plus className="mr-2 h-4 w-4" /> Add Tenant
                    </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="documents">
              <AccordionTrigger className="text-lg font-semibold"><FileText className="mr-2 h-5 w-5 text-slate-500" /> Unit Documents</AccordionTrigger>
              <AccordionContent className="pt-2">
                 {unit && user && (
                    <UnitDocuments propertyId={propertyId} unitId={unit.id} landlordId={user.uid} />
                 )}
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="specs">
              <AccordionTrigger className="text-lg font-semibold"><Hash className="mr-2 h-5 w-5 text-slate-500" /> Unit Specifications</AccordionTrigger>
              <AccordionContent className="pt-4">
                 <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-2"><Label className="text-xs">Beds</Label><Input type="number" {...register('bedrooms')} /></div>
                      <div className="space-y-2"><Label className="text-xs">Baths</Label><Input type="number" {...register('bathrooms')} /></div>
                      <div className="space-y-2"><Label className="text-xs">Sq. Ft.</Label><Input type="number" {...register('sqft')} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label className="text-xs">Default Rent ($)</Label><Input type="number" {...register('targetRent')} /></div>
                      <div className="space-y-2"><Label className="text-xs">Default Deposit ($)</Label><Input type="number" {...register('securityDeposit')} /></div>
                    </div>
                 </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
          

          <div className="pt-4 border-t">
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-lg font-bold shadow-lg" disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Update Unit"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
