'use client';

import { useState, useEffect, useMemo } from 'react';
import { doc, updateDoc, collection, query } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { useFieldArray, useForm, Controller } from 'react-hook-form';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Users, Plus, Trash2, FileText, UploadCloud, Eye, Key, Wrench, FolderArchive, Fingerprint, UserPlus } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { TenantDocumentUploader } from '@/components/tenants/TenantDocumentUploader';
import { deleteDocumentNonBlocking } from '@/firebase';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { InviteTenantModal } from '@/components/tenants/InviteTenantModal';


function UnitDocuments({ propertyId, unitId, landlordId }: { propertyId: string; unitId: string; landlordId: string }) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isUploaderOpen, setUploaderOpen] = useState(false);

  const docsQuery = useMemoFirebase(() => {
    if (!firestore || !propertyId || !unitId) return null;
    return query(collection(firestore, `properties/${propertyId}/units/${unitId}/documents`));
  }, [firestore, propertyId, unitId]);

  const { data: documents, isLoading, refetch: refetchDocs } = useCollection(docsQuery);

  const handleDelete = (docData: any) => {
    if (!firestore || !docData?.storagePath) {
      toast({ variant: 'destructive', title: 'Error', description: 'Cannot delete document due to missing information.' });
      return;
    }
    if (!confirm(`Are you sure you want to delete ${docData.fileName}?`)) return;

    const docRef = doc(firestore, `properties/${propertyId}/units/${unitId}/documents`, docData.id);
    deleteDocumentNonBlocking(docRef);
    // Optimistically update UI
    refetchDocs();
    toast({ title: 'Document Deleted' });
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
    <div className="space-y-3">
      <Button type="button" size="sm" variant="outline" onClick={() => setUploaderOpen(true)} className="w-full gap-2 border-dashed">
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
              <a href={doc.downloadUrl} target="_blank" rel="noopener noreferrer"><Button type="button" variant="ghost" size="icon" className="h-7 w-7"><Eye className="h-4 w-4"/></Button></a>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-500" onClick={() => handleDelete(doc)}><Trash2 className="h-4 w-4"/></Button>
            </div>
          </div>
        ))}
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
    </div>
  );
}

const ALL_AMENITIES = [
  "Stove", "Fridge", "Washer", "Dryer", "Dishwasher", "Microwave",
  "Balcony/Patio", "A/C", "Heating", "Parking", "Hardwood Floors", "Carpet"
];


export function UnitDetailDrawer({ propertyId, unit, isOpen, onOpenChange, onUpdate }: any) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const { user } = useUser();

  const formValues = useMemo(() => ({
    unitNumber: unit?.unitNumber || '',
    bedrooms: unit?.bedrooms || 0,
    bathrooms: unit?.bathrooms || 0,
    sqft: unit?.sqft || 0,
    amenities: unit?.amenities || [],
    tenants: unit?.tenants || [],
    access: unit?.access || { gateCode: '', lockboxCode: '', notes: '' }
  }), [unit]);

  const { register, control, handleSubmit, getValues, reset } = useForm({
    values: formValues
  });
  
  useEffect(() => {
    reset(formValues);
  }, [formValues, reset]);

  const { fields, append, remove } = useFieldArray({
    control,
    name: "tenants"
  });

  const handleRemoveTenant = async (index: number) => {
    if (!firestore || !unit) return;
    
    const currentTenants = getValues('tenants');
    const updatedTenants = currentTenants.filter((_:any, i:number) => i !== index);

    const unitRef = doc(firestore, 'properties', propertyId, 'units', unit.id);
    
    try {
      await updateDoc(unitRef, { tenants: updatedTenants });
      toast({ title: "Tenant Removed", description: "The tenant has been deleted from this unit." });
      if (onUpdate) onUpdate();
    } catch (error: any) {
      toast({ variant: 'destructive', title: "Error", description: `Could not remove tenant: ${error.message}`});
    }
  };

  const onSubmit = async (data: any) => {
    if (!firestore || !unit) return;
    setIsSaving(true);

    const unitRef = doc(firestore, 'properties', propertyId, 'units', unit.id);

    try {
      await updateDoc(unitRef, data);
      
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
    <>
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
            <SheetDescription>Update tenant leases, unit specs, and documents.</SheetDescription>
          </SheetHeader>
          
          <form onSubmit={handleSubmit(onSubmit)}>
              <div className="space-y-1 pt-6">
                  <Accordion type="multiple" defaultValue={['tenants']}>
                  
                  <AccordionItem value="tenants">
                      <AccordionTrigger className="text-lg font-semibold"><Key className="mr-2 h-5 w-5 text-slate-500" /> Tenants & Lease</AccordionTrigger>
                      <AccordionContent className="pt-2">
                          <div className="space-y-4">
                              {fields.map((field, index) => (
                                  <div key={field.id} className="p-4 bg-slate-50 rounded-lg border space-y-3 relative">
                                      <Button 
                                          type="button" 
                                          variant="ghost" 
                                          size="icon" 
                                          onClick={() => handleRemoveTenant(index)}
                                          className="absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:text-destructive"
                                      >
                                          <Trash2 className="h-4 w-4" />
                                      </Button>
                                      <div className="grid grid-cols-2 gap-4">
                                          <div className="space-y-1"><Label className="text-xs">First Name *</Label><Input {...register(`tenants.${index}.firstName`)} /></div>
                                          <div className="space-y-1"><Label className="text-xs">Last Name *</Label><Input {...register(`tenants.${index}.lastName`)} /></div>
                                      </div>
                                      <div className="grid grid-cols-2 gap-4">
                                          <div className="space-y-1"><Label className="text-xs">Email *</Label><Input type="email" {...register(`tenants.${index}.email`)} /></div>
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
                              <div className="flex gap-2">
                                  <Button
                                      type="button"
                                      variant="outline"
                                      className="w-full border-dashed"
                                      onClick={() => append({ firstName: '', lastName: '', email: '', phone: '', leaseStart: '', leaseEnd: '', rentAmount: 0, deposit: 0 })}
                                  >
                                      <Plus className="mr-2 h-4 w-4" /> Add Tenant
                                  </Button>
                                  <Button
                                      type="button"
                                      variant="secondary"
                                      className="w-full"
                                      onClick={() => setIsInviteOpen(true)}
                                  >
                                      <UserPlus className="mr-2 h-4 w-4" /> Invite Tenant
                                  </Button>
                              </div>
                          </div>
                      </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="access">
                      <AccordionTrigger className="text-lg font-semibold"><Fingerprint className="mr-2 h-5 w-5 text-slate-500" /> Access Codes</AccordionTrigger>
                      <AccordionContent className="pt-4">
                          <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2"><Label>Building/Gate Code</Label><Input {...register('access.gateCode')} /></div>
                                  <div className="space-y-2"><Label>Unit Lockbox Code</Label><Input {...register('access.lockboxCode')} /></div>
                              </div>
                              <div className="space-y-2">
                                  <Label>Access Notes</Label>
                                  <Textarea placeholder="e.g., 'Key is under the mat', 'Call before arriving'" {...register('access.notes')} />
                              </div>
                          </div>
                      </AccordionContent>
                  </AccordionItem>
                  
                  <AccordionItem value="specs">
                      <AccordionTrigger className="text-lg font-semibold"><Wrench className="mr-2 h-5 w-5 text-slate-500" /> Unit Specifications</AccordionTrigger>
                      <AccordionContent className="pt-4">
                          <div className="space-y-4">
                              <div className="grid grid-cols-3 gap-2">
                                  <div className="space-y-2"><Label className="text-xs">Beds</Label><Input type="number" {...register('bedrooms')} /></div>
                                  <div className="space-y-2"><Label className="text-xs">Baths</Label><Input type="number" {...register('bathrooms')} /></div>
                                  <div className="space-y-2"><Label className="text-xs">Sq. Ft.</Label><Input type="number" {...register('sqft')} /></div>
                              </div>
                              <div className="space-y-2 pt-4 border-t">
                                  <Label>Amenities</Label>
                                  <Controller
                                      control={control}
                                      name="amenities"
                                      render={({ field }) => (
                                          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                              {ALL_AMENITIES.map(amenity => (
                                                  <div key={amenity} className="flex items-center gap-2">
                                                      <Checkbox
                                                          id={`amenity-${amenity}`}
                                                          checked={field.value?.includes(amenity)}
                                                          onCheckedChange={(checked) => {
                                                              const currentValues = field.value || [];
                                                              const newValues = checked
                                                                  ? [...currentValues, amenity]
                                                                  : currentValues.filter(val => val !== amenity);
                                                              field.onChange(newValues);
                                                          }}
                                                      />
                                                      <Label htmlFor={`amenity-${amenity}`} className="font-normal text-sm">
                                                          {amenity}
                                                      </Label>
                                                  </div>
                                              ))}
                                          </div>
                                      )}
                                  />
                              </div>
                          </div>
                      </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="documents">
                      <AccordionTrigger className="text-lg font-semibold"><FolderArchive className="mr-2 h-5 w-5 text-slate-500" /> Unit Documents</AccordionTrigger>
                      <AccordionContent className="pt-2">
                      {unit && user && (
                          <UnitDocuments propertyId={propertyId} unitId={unit.id} landlordId={user.uid} />
                      )}
                      </AccordionContent>
                  </AccordionItem>
                  </Accordion>
              </div>
              
              <div className="pt-8">
                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-lg font-bold shadow-lg" disabled={isSaving}>
                  {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Update Unit"}
                </Button>
              </div>
          </form>
        </SheetContent>
      </Sheet>
      {isInviteOpen && user && (
        <InviteTenantModal
          isOpen={isInviteOpen}
          onOpenChange={setIsInviteOpen}
          landlordId={user.uid}
          propertyId={propertyId}
          unitId={unit.id} // Pass the unit ID
        />
      )}
    </>
  );
}
