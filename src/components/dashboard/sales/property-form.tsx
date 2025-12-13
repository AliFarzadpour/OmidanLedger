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
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { Form, FormControl, FormField, FormItem } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';


// --- SCHEMA DEFINITION ---
const propertySchema = z.object({
  name: z.string().min(1, "Nickname is required"),
  propertyType: z.string().optional(),
  address: z.object({
    street: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(2),
    zip: z.string().min(5),
  }),
  financials: z.object({
    targetRent: z.coerce.number().min(0),
    securityDeposit: z.coerce.number().min(0),
    purchasePrice: z.coerce.number().optional(),
    purchaseDate: z.string().optional(),
  }),
  mortgage: z.object({
    hasMortgage: z.enum(['yes', 'no']),
    lenderName: z.string().optional(),
    accountNumber: z.string().optional(), // NEW
    
    // Lender Contact (NEW)
    lenderPhone: z.string().optional(),
    lenderEmail: z.string().email().optional().or(z.literal('')), 
    
    // Loan Details
    monthlyPayment: z.coerce.number().optional(),
    interestRate: z.coerce.number().optional(),
    loanBalance: z.coerce.number().optional(),

    // Escrow Details (NEW)
    escrow: z.object({
      includesTax: z.boolean().default(false),
      includesInsurance: z.boolean().default(false),
      includesHoa: z.boolean().default(false),
    }).optional(),
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
    internet: z.enum(['tenant', 'landlord']),
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
      propertyType: 'single-family',
      address: { street: '', city: '', state: '', zip: '' },
      financials: { targetRent: 0, securityDeposit: 0 },
      mortgage: { hasMortgage: 'no' as 'yes' | 'no', lenderName: '', monthlyPayment: 0, interestRate: 0 },
      hoa: { hasHoa: 'no' as 'yes' | 'no', fee: 0, frequency: 'monthly' as 'monthly' | 'quarterly' | 'annually', contactPhone: '' },
      utilities: { water: 'tenant' as 'tenant' | 'landlord', electric: 'tenant' as 'tenant' | 'landlord', gas: 'tenant' as 'tenant' | 'landlord', trash: 'tenant' as 'tenant' | 'landlord', internet: 'tenant' as 'tenant' | 'landlord' },
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
    
    const newRef = doc(collection(firestore, 'properties'));
    const propertyData = {
        id: newRef.id,
        userId: user.uid,
        status: 'vacant',
        createdAt: new Date().toISOString(),
        ...data
    };

    setDoc(newRef, propertyData).then(() => {
        toast({ title: "Property Saved", description: "All details recorded successfully." });
        if (onSuccess) onSuccess();
    }).catch(error => {
        const permissionError = new FirestorePermissionError({
            path: newRef.path,
            operation: 'create',
            requestResourceData: propertyData,
        });
        errorEmitter.emit('permission-error', permissionError);
    }).finally(() => {
        setIsSaving(false);
    });
  };

  // --- NAVIGATION ITEMS ---
  const navItems = [
    { id: 'general', label: 'General Info', icon: Building2 },
    { id: 'financials', label: 'Rent & Income', icon: DollarSign },
    { id: 'mortgage', label: 'Mortgage & Debt', icon: Landmark },
    { id: 'hoa', label: 'HOA & Fees', icon: Users },
    { id: 'utilities', label: 'Utilities', icon: Zap },
    { id: 'access', label: 'Access & Keys', icon: Key },
    { id: 'vendors', label: 'Preferred Vendors', icon: Users },
  ];

  return (
    <Form {...form}>
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
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Property Nickname</Label>
                  <Input placeholder="e.g. The Lake House" {...form.register('name')} />
                </div>
                 <div className="grid gap-2">
                  <Label>Property Type</Label>
                  <Select onValueChange={(val: any) => form.setValue('propertyType', val)} defaultValue="single-family">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="single-family">Single Family</SelectItem>
                        <SelectItem value="multi-family">Multi-Family</SelectItem>
                        <SelectItem value="condo">Condo</SelectItem>
                        <SelectItem value="townhouse">Townhouse</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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

        {/* SECTION: FINANCIALS (Now focused on Income) */}
        {activeSection === 'financials' && (
          <Card>
            <CardHeader>
              <CardTitle>Income Targets</CardTitle>
              <CardDescription>What is the revenue potential?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Target Monthly Rent</Label>
                  <Input type="number" {...form.register('financials.targetRent')} />
                </div>
                <div className="grid gap-2">
                  <Label>Security Deposit</Label>
                  <Input type="number" {...form.register('financials.securityDeposit')} />
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Purchase Price</Label>
                  <Input type="number" {...form.register('financials.purchasePrice')} />
                </div>
                <div className="grid gap-2">
                   <Label>Purchase Date</Label>
                   <Input type="date" {...form.register('financials.purchaseDate')} />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* SECTION: MORTGAGE (New Dedicated Section) */}
        {activeSection === 'mortgage' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Loan Information</CardTitle>
                <CardDescription>Track your debt service and escrow.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Main Toggle */}
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <Label className="text-base">Is there a mortgage on this property?</Label>
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
                    <Input placeholder="e.g. Wells Fargo" {...form.register('mortgage.lenderName')} />
                  </div>
                  <div className="grid gap-2">
                     <Label>Loan Account Number</Label>
                     <Input placeholder="####-####" {...form.register('mortgage.accountNumber')} />
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-2">
                     <Label>Total Monthly Payment</Label>
                     <Input type="number" placeholder="0.00" {...form.register('mortgage.monthlyPayment')} />
                  </div>
                  <div className="grid gap-2">
                     <Label>Interest Rate (%)</Label>
                     <Input type="number" step="0.01" placeholder="4.5" {...form.register('mortgage.interestRate')} />
                  </div>
                  <div className="grid gap-2">
                     <Label>Current Balance</Label>
                     <Input type="number" placeholder="0.00" {...form.register('mortgage.loanBalance')} />
                  </div>
                </div>

                <Separator />
                
                {/* Contact Info */}
                <div className="grid grid-cols-2 gap-4">
                   <div className="grid gap-2">
                     <Label>Lender Phone</Label>
                     <Input placeholder="(555) 000-0000" {...form.register('mortgage.lenderPhone')} />
                   </div>
                   <div className="grid gap-2">
                     <Label>Lender Email / Portal</Label>
                     <Input placeholder="support@bank.com" {...form.register('mortgage.lenderEmail')} />
                   </div>
                </div>
              </CardContent>
            </Card>

            {/* Escrow Settings */}
            <Card>
              <CardHeader>
                 <CardTitle>Escrow Details</CardTitle>
                 <CardDescription>What is included in your monthly payment?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                 <FormField
                    control={form.control}
                    name="mortgage.escrow.includesTax"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between border-b pb-3">
                        <Label>Includes Property Taxes?</Label>
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                 <FormField
                    control={form.control}
                    name="mortgage.escrow.includesInsurance"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between border-b pb-3">
                        <Label>Includes Home Insurance?</Label>
                         <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="mortgage.escrow.includesHoa"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                         <Label>Includes HOA Fees?</Label>
                         <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
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
                    { key: 'internet', label: 'Internet' },
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
    </Form>
  );
}