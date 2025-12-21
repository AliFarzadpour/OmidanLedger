'use client';

import { useState, useEffect, useRef } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useFieldArray, useForm } from 'react-hook-form';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Hash, Users, Plus, Trash2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export function UnitDetailDrawer({ propertyId, unit, isOpen, onOpenChange, onUpdate }: any) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const addTenantButtonRef = useRef<HTMLButtonElement>(null);

  const { register, control, handleSubmit, getValues } = useForm({
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

  const { fields, append, remove } = useFieldArray({
    control,
    name: "tenants"
  });

  useEffect(() => {
    if (isOpen) {
      // Use a short timeout to ensure the button is in the DOM and focusable
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
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 pt-6">
          
          {/* TENANTS SECTION */}
          <div>
              <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                  <Users className="h-5 w-5 text-slate-500" /> Tenants & Lease
              </h3>
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
                              <div className="space-y-1">
                                  <Label className="text-xs">First Name</Label>
                                  <Input {...register(`tenants.${index}.firstName`)} />
                              </div>
                              <div className="space-y-1">
                                  <Label className="text-xs">Last Name</Label>
                                  <Input {...register(`tenants.${index}.lastName`)} />
                              </div>
                          </div>
                           <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                  <Label className="text-xs">Email</Label>
                                  <Input type="email" {...register(`tenants.${index}.email`)} />
                              </div>
                               <div className="space-y-1">
                                  <Label className="text-xs">Phone</Label>
                                  <Input {...register(`tenants.${index}.phone`)} />
                              </div>
                          </div>
                           <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                              <div className="space-y-1">
                                  <Label className="text-xs">Lease Start</Label>
                                  <Input type="date" {...register(`tenants.${index}.leaseStart`)} />
                              </div>
                               <div className="space-y-1">
                                  <Label className="text-xs">Lease End</Label>
                                  <Input type="date" {...register(`tenants.${index}.leaseEnd`)} />
                              </div>
                          </div>
                           <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                  <Label className="text-xs">Rent Amount ($)</Label>
                                  <Input type="number" {...register(`tenants.${index}.rentAmount`)} />
                              </div>
                               <div className="space-y-1">
                                  <Label className="text-xs">Deposit Held ($)</Label>
                                  <Input type="number" {...register(`tenants.${index}.deposit`)} />
                              </div>
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
          </div>
          

          <div className="space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2"><span className="w-1 h-4 bg-blue-500 rounded-full" /> Unit Specs</h3>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-2"><Label className="text-xs">Beds</Label><Input type="number" {...register('bedrooms')} /></div>
              <div className="space-y-2"><Label className="text-xs">Baths</Label><Input type="number" {...register('bathrooms')} /></div>
              <div className="space-y-2"><Label className="text-xs">Sq. Ft.</Label><Input type="number" {...register('sqft')} /></div>
            </div>
          </div>
          
          <div className="space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2"><span className="w-1 h-4 bg-green-500 rounded-full" /> Building Financial Defaults</h3>
             <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label className="text-xs">Default Rent ($)</Label><Input type="number" {...register('targetRent')} /></div>
              <div className="space-y-2"><Label className="text-xs">Default Deposit ($)</Label><Input type="number" {...register('securityDeposit')} /></div>
            </div>
             <p className="text-xs text-muted-foreground -mt-2">This is the default rent for new tenants added to this unit.</p>
          </div>

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
