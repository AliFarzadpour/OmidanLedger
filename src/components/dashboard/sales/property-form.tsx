'use client';

import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  Building2, DollarSign, Key, Zap, Users, Save, Plus, Trash2, Home, Landmark 
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore } from '@/firebase';
import { doc, setDoc, collection } from 'firebase/firestore';
import { cn } from '@/lib/utils';

// --- SCHEMA DEFINITION ---
const propertySchema = z.object({
  name: z.string().min(1, "Nickname is required"),
  address: z.object({
    street: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(2),
    zip: z.string().min(5),
  }),
  financials: z.object({
    targetRent: z.coerce.number().min(0),
    securityDeposit: z.coerce.number().min(0),
  }),
  mortgage: z.object({
    hasMortgage: z.enum(['yes', 'no']),
    lenderName: z.string().optional(),
    monthlyPayment: z.coerce.number().optional(),
    interestRate: z.coerce.number().optional(),
  }),
  hoa: z.object({
    hasHoa: z.enum(['yes', 'no']),
    fee: z.coerce.number().optional(),
    frequency: z.enum(['monthly', 'quarterly', 'annually']).optional(),
    contactPhone: z.string().optional(),
  }),
  utilities: z.object({
    water: z.enum(['tenant', 'landlord']),
    electric: z.enum(['tenant', 'landlord']),
    gas: z.enum(['tenant', 'landlord']),
    trash: z.enum(['tenant', 'landlord']),
  }),
  access: z.object({
    gateCode: z.string().optional(),
    lockboxCode: z.string().optional(),
    notes: z.string().optional(),
  }),
  preferredVendors: z.array(z.object({
    role: z.string(),
    name: z.string(),
    phone: z.string(),
  })).optional(),
});

// --- MAIN COMPONENT ---
export function PropertyForm({ onSuccess }: { onSuccess?: () => void }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState("general");
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      name: '',
      address: { street: '', city: '', state: '', zip: '' },
      financials: { targetRent: 0, securityDeposit: 0 },
      mortgage: { hasMortgage: 'no' as 'yes' | 'no', lenderName: '', monthlyPayment: 0, interestRate: 0 },
      hoa: { hasHoa: 'no' as 'yes' | 'no', fee: 0, frequency: 'monthly' as 'monthly' | 'quarterly' | 'annually', contactPhone: '' },
      utilities: { water: 'tenant' as 'tenant' | 'landlord', electric: 'tenant' as 'tenant' | 'landlord', gas: 'tenant' as 'tenant' | 'landlord', trash: 'tenant' as 'tenant' | 'landlord' },
      access: { gateCode: '', lockboxCode: '', notes: '' },
      preferredVendors: [{ role: 'Handyman', name: '', phone: '' }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "preferredVendors"
  });

  const onSubmit = async (data: any) => {
    if (!user || !firestore) return;
    setIsSaving(true);
    try {
      const newRef = doc(collection(firestore, 'properties'));
      // Flatten the structure slightly if needed, or keep nested
      await setDoc(newRef, {
        id: newRef.id,
        userId: user.uid,
        status: 'vacant',
        createdAt: new Date().toISOString(),
        ...data
      });
      toast({ title: "Property Saved", description: "All details recorded successfully." });
      if (onSuccess) onSuccess();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  // --- NAVIGATION ITEMS ---
  const navItems = [
    { id: 'general', label: 'General Info', icon: Building2 },
    { id: 'financials', label: 'Rent & Mortgage', icon: DollarSign },
    { id: 'hoa', label: 'HOA & Fees', icon: Landmark },
    { id: 'utilities', label: 'Utilities', icon: Zap },
    { id: 'access', label: 'Access & Keys', icon: Key },
    { id: 'vendors', label: 'Preferred Vendors', icon: Users },
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full min-h-[500px]">
      
      {/* LEFT SIDEBAR NAVIGATION */}
      <div className="w-full lg:w-64 flex-shrink-0 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveSection(item.id)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors",
              activeSection === item.id 
                ? "bg-primary text-primary-foreground shadow-sm" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
        
        <Separator className="my-4" />
        
        <div className="px-4">
           <Button 
             className="w-full bg-green-600 hover:bg-green-700" 
             onClick={form.handleSubmit(onSubmit)}
             disabled={isSaving}
           >
             {isSaving ? "Saving..." : <><Save className="mr-2 h-4 w-4" /> Save Property</>}
           </Button>
        </div>
      </div>

      {/* RIGHT CONTENT AREA */}
      <div className="flex-1 space-y-6 overflow-y-auto pr-1">
        
        {/* SECTION: GENERAL */}
        {activeSection === 'general' && (
          <Card>
            <CardHeader>
              <CardTitle>General Information</CardTitle>
              <CardDescription>Address and nickname for the property.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>Property Nickname</Label>
                <Input placeholder="e.g. The Lake House" {...form.register('name')} />
              </div>
              <Separator />
              <div className="grid gap-2">
                <Label>Street Address</Label>
                <Input placeholder="123 Main St" {...form.register('address.street')} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label>City</Label>
                  <Input placeholder="City" {...form.register('address.city')} />
                </div>
                <div className="grid gap-2">
                  <Label>State</Label>
                  <Input placeholder="TX" {...form.register('address.state')} />
                </div>
                <div className="grid gap-2">
                  <Label>Zip Code</Label>
                  <Input placeholder="00000" {...form.register('address.zip')} />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* SECTION: FINANCIALS (Rent + Mortgage) */}
        {activeSection === 'financials' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Target Revenue</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Monthly Rent Target</Label>
                  <Input type="number" {...form.register('financials.targetRent')} />
                </div>
                <div className="grid gap-2">
                  <Label>Security Deposit</Label>
                  <Input type="number" {...form.register('financials.securityDeposit')} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Mortgage Information</CardTitle>
                <CardDescription>Required for accurate cash flow calculations.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-4 mb-4">
                  <Label>Is there a mortgage?</Label>
                  <RadioGroup 
                    defaultValue="no" 
                    onValueChange={(val: any) => form.setValue('mortgage.hasMortgage', val)}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yes" id="m-yes" />
                      <Label htmlFor="m-yes">Yes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="no" id="m-no" />
                      <Label htmlFor="m-no">No</Label>
                    </div>
                  </RadioGroup>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Lender Name</Label>
                    <Input placeholder="Bank of America" {...form.register('mortgage.lenderName')} />
                  </div>
                  <div className="grid gap-2">
                     <Label>Interest Rate (%)</Label>
                     <Input placeholder="4.5" type="number" step="0.1" {...form.register('mortgage.interestRate')} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Monthly Payment (P&I)</Label>
                    <Input placeholder="0.00" type="number" {...form.register('mortgage.monthlyPayment')} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* SECTION: HOA */}
        {activeSection === 'hoa' && (
          <Card>
            <CardHeader>
              <CardTitle>Homeowners Association (HOA)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
               <div className="flex items-center space-x-4 mb-4">
                  <Label>Is there an HOA?</Label>
                  <RadioGroup 
                    defaultValue="no" 
                    onValueChange={(val: any) => form.setValue('hoa.hasHoa', val)}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yes" id="h-yes" />
                      <Label htmlFor="h-yes">Yes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="no" id="h-no" />
                      <Label htmlFor="h-no">No</Label>
                    </div>
                  </RadioGroup>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="grid gap-2">
                      <Label>Fee Amount</Label>
                      <Input type="number" placeholder="0.00" {...form.register('hoa.fee')} />
                   </div>
                   <div className="grid gap-2">
                      <Label>Frequency</Label>
                      <Select onValueChange={(val: any) => form.setValue('hoa.frequency', val)} defaultValue="monthly">
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="quarterly">Quarterly</SelectItem>
                            <SelectItem value="annually">Annually</SelectItem>
                        </SelectContent>
                      </Select>
                   </div>
                   <div className="grid gap-2 col-span-2">
                      <Label>Contact Phone / Email</Label>
                      <Input placeholder="(555) 123-4567" {...form.register('hoa.contactPhone')} />
                   </div>
                </div>
            </CardContent>
          </Card>
        )}

        {/* SECTION: UTILITIES */}
        {activeSection === 'utilities' && (
          <Card>
            <CardHeader>
              <CardTitle>Utility Responsibility</CardTitle>
              <CardDescription>Who pays for what?</CardDescription>
            </CardHeader>
            <CardContent>
               <div className="space-y-4">
                  {[
                    { key: 'water', label: 'Water & Sewer' },
                    { key: 'electric', label: 'Electricity' },
                    { key: 'gas', label: 'Gas' },
                    { key: 'trash', label: 'Trash Pickup' },
                  ].map((util) => (
                    <div key={util.key} className="flex items-center justify-between p-3 border rounded-lg">
                       <span className="font-medium">{util.label}</span>
                       <RadioGroup 
                         defaultValue="tenant"
                         onValueChange={(val: any) => form.setValue(`utilities.${util.key}` as any, val)}
                         className="flex gap-4"
                       >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="tenant" id={`${util.key}-t`} />
                            <Label htmlFor={`${util.key}-t`}>Tenant</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="landlord" id={`${util.key}-l`} />
                            <Label htmlFor={`${util.key}-l`}>Landlord</Label>
                          </div>
                       </RadioGroup>
                    </div>
                  ))}
               </div>
            </CardContent>
          </Card>
        )}

        {/* SECTION: ACCESS */}
        {activeSection === 'access' && (
          <Card>
            <CardHeader>
              <CardTitle>Access Information</CardTitle>
              <CardDescription>Secure codes and key locations.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
               <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                     <Label>Gate Code</Label>
                     <Input placeholder="#1234" {...form.register('access.gateCode')} />
                  </div>
                  <div className="grid gap-2">
                     <Label>Lockbox / Door Code</Label>
                     <Input placeholder="4321" {...form.register('access.lockboxCode')} />
                  </div>
               </div>
               <div className="grid gap-2">
                  <Label>Other Notes (Wifi, Alarm, Spare Key)</Label>
                  <Input placeholder="Spare key under the mat..." {...form.register('access.notes')} />
               </div>
            </CardContent>
          </Card>
        )}

        {/* SECTION: VENDORS */}
        {activeSection === 'vendors' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                 <div>
                    <CardTitle>Preferred Vendors</CardTitle>
                    <CardDescription>Who fixes this house?</CardDescription>
                 </div>
                 <Button size="sm" variant="outline" onClick={() => append({ role: '', name: '', phone: '' })}>
                    <Plus className="h-4 w-4 mr-2" /> Add Vendor
                 </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
               {fields.map((field, index) => (
                 <div key={field.id} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-4 grid gap-1">
                       <Label className="text-xs">Role</Label>
                       <Input placeholder="Plumber" {...form.register(`preferredVendors.${index}.role`)} />
                    </div>
                    <div className="col-span-4 grid gap-1">
                       <Label className="text-xs">Name</Label>
                       <Input placeholder="Joe Smith" {...form.register(`preferredVendors.${index}.name`)} />
                    </div>
                    <div className="col-span-3 grid gap-1">
                       <Label className="text-xs">Phone</Label>
                       <Input placeholder="555-0000" {...form.register(`preferredVendors.${index}.phone`)} />
                    </div>
                    <div className="col-span-1">
                       <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(index)}>
                          <Trash2 className="h-4 w-4" />
                       </Button>
                    </div>
                 </div>
               ))}
               {fields.length === 0 && (
                 <p className="text-sm text-muted-foreground text-center py-4">No vendors added yet.</p>
               )}
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
    