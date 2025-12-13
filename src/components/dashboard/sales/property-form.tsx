'use client';

import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  Building2, DollarSign, Key, Zap, Users, Save, Plus, Trash2, Home, Landmark, 
  FileText, Wrench, UserCheck 
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
import { Textarea } from '@/components/ui/textarea';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { Form } from '@/components/ui/form';


// --- SCHEMA DEFINITION ---
const propertySchema = z.object({
  name: z.string().min(1, "Nickname is required"),
  type: z.enum(['single-family', 'multi-family', 'condo', 'commercial']),
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
    accountNumber: z.string().optional(),
    lenderPhone: z.string().optional(),
    lenderEmail: z.string().optional(),
    monthlyPayment: z.coerce.number().optional(),
    interestRate: z.coerce.number().optional(),
    loanBalance: z.coerce.number().optional(),
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
    contactName: z.string().optional(),
    contactPhone: z.string().optional(),
    contactEmail: z.string().optional(),
  }),
  utilities: z.array(z.object({
    type: z.string(), // Water, Electric, etc.
    responsibility: z.enum(['tenant', 'landlord']),
    providerName: z.string().optional(),
    providerContact: z.string().optional(),
  })),
  access: z.object({
    gateCode: z.string().optional(),
    lockboxCode: z.string().optional(),
    notes: z.string().optional(),
  }),
  // NEW: Tenants Array
  tenants: z.array(z.object({
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().email().optional().or(z.literal('')),
    phone: z.string().optional(),
    leaseStart: z.string().optional(),
    leaseEnd: z.string().optional(),
  })).optional(),
  // NEW: Rent Roll (Lease Financials)
  rentRoll: z.object({
    currentMonthlyRent: z.coerce.number().optional(),
    securityDepositHeld: z.coerce.number().optional(),
    nextRentDueDate: z.string().optional(),
    leaseStatus: z.enum(['active', 'month-to-month', 'expiring', 'vacant']).default('vacant'),
  }).optional(),
  // NEW: Maintenance Log
  maintenance: z.array(z.object({
    date: z.string().optional(),
    description: z.string(),
    cost: z.coerce.number().optional(),
    vendor: z.string().optional(),
  })).optional(),
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
      type: 'single-family' as const,
      address: { street: '', city: '', state: '', zip: '' },
      financials: { targetRent: 0, securityDeposit: 0 },
      mortgage: { 
        hasMortgage: 'no' as const, 
        lenderName: '', 
        escrow: { includesTax: false, includesInsurance: false, includesHoa: false } 
      },
      hoa: { hasHoa: 'no' as const, fee: 0, frequency: 'monthly' as const, contactName: '', contactPhone: '', contactEmail: '' },
      // Default Utilities structure
      utilities: [
        { type: 'Water', responsibility: 'tenant' as const, providerName: '', providerContact: '' },
        { type: 'Electric', responsibility: 'tenant' as const, providerName: '', providerContact: '' },
        { type: 'Gas', responsibility: 'tenant' as const, providerName: '', providerContact: '' },
        { type: 'Trash', responsibility: 'tenant' as const, providerName: '', providerContact: '' },
        { type: 'Internet', responsibility: 'tenant' as const, providerName: '', providerContact: '' },
      ],
      access: { gateCode: '', lockboxCode: '', notes: '' },
      tenants: [],
      rentRoll: { leaseStatus: 'vacant' as const, currentMonthlyRent: 0, securityDepositHeld: 0 },
      maintenance: [],
      preferredVendors: [{ role: 'Handyman', name: '', phone: '' }]
    }
  });

  // Array Field Handlers
  const vendorFields = useFieldArray({ control: form.control, name: "preferredVendors" });
  const tenantFields = useFieldArray({ control: form.control, name: "tenants" });
  const maintenanceFields = useFieldArray({ control: form.control, name: "maintenance" });
  const utilityFields = useFieldArray({ control: form.control, name: "utilities" });

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

  // Navigation Menu
  const navItems = [
    { id: 'general', label: 'General Info', icon: Building2 },
    { id: 'financials', label: 'Rent Targets', icon: DollarSign },
    { id: 'mortgage', label: 'Mortgage & Loan', icon: Landmark },
    { id: 'hoa', label: 'HOA', icon: Users },
    { id: 'utilities', label: 'Utilities', icon: Zap },
    { id: 'access', label: 'Access & Keys', icon: Key },
    { id: 'tenants', label: 'Tenants', icon: UserCheck },    // NEW
    { id: 'rentroll', label: 'Rent Roll', icon: FileText },  // NEW
    { id: 'maintenance', label: 'Maintenance', icon: Wrench }, // NEW
    { id: 'vendors', label: 'Vendors', icon: Users },
  ];

  return (
    <Form {...form}>
    <div className="flex flex-col lg:flex-row gap-6 h-full min-h-[600px]">
      
      {/* SIDEBAR */}
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

      {/* CONTENT AREA */}
      <div className="flex-1 space-y-6 overflow-y-auto pr-1 pb-10">
        
        {/* --- 1. GENERAL --- */}
        {activeSection === 'general' && (
          <Card>
            <CardHeader><CardTitle>General Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>Property Nickname</Label>
                <Input placeholder="e.g. The Lake House" {...form.register('name')} />
              </div>
              <div className="grid gap-2">
                <Label>Property Type</Label>
                <Select onValueChange={(val: any) => form.setValue('type', val)} defaultValue="single-family">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="single-family">Single Family Home</SelectItem>
                        <SelectItem value="multi-family">Multi-Family / Duplex</SelectItem>
                        <SelectItem value="condo">Condo / Townhouse</SelectItem>
                        <SelectItem value="commercial">Commercial</SelectItem>
                    </SelectContent>
                </Select>
              </div>
              <Separator />
              <div className="grid gap-2">
                <Label>Street Address</Label>
                <Input placeholder="123 Main St" {...form.register('address.street')} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2"><Label>City</Label><Input {...form.register('address.city')} /></div>
                <div className="grid gap-2"><Label>State</Label><Input {...form.register('address.state')} /></div>
                <div className="grid gap-2"><Label>Zip</Label><Input {...form.register('address.zip')} /></div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* --- 2. FINANCIALS (TARGETS) --- */}
        {activeSection === 'financials' && (
          <Card>
            <CardHeader>
              <CardTitle>Market Targets</CardTitle>
              <CardDescription>What you expect to earn from this property.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Target Monthly Rent</Label><Input type="number" {...form.register('financials.targetRent')} /></div>
              <div className="grid gap-2"><Label>Security Deposit Req.</Label><Input type="number" {...form.register('financials.securityDeposit')} /></div>
              <div className="grid gap-2"><Label>Purchase Price</Label><Input type="number" {...form.register('financials.purchasePrice')} /></div>
              <div className="grid gap-2"><Label>Purchase Date</Label><Input type="date" {...form.register('financials.purchaseDate')} /></div>
            </CardContent>
          </Card>
        )}

        {/* --- 3. MORTGAGE (MERGED ESCROW) --- */}
        {activeSection === 'mortgage' && (
          <Card>
            <CardHeader><CardTitle>Loan Information</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <Label>Is there a mortgage?</Label>
                <RadioGroup defaultValue="no" onValueChange={(val: any) => form.setValue('mortgage.hasMortgage', val)} className="flex gap-4">
                  <div className="flex items-center space-x-2"><RadioGroupItem value="yes" id="m-yes" /><Label htmlFor="m-yes">Yes</Label></div>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="no" id="m-no" /><Label htmlFor="m-no">No</Label></div>
                </RadioGroup>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>Lender Name</Label><Input {...form.register('mortgage.lenderName')} /></div>
                <div className="grid gap-2"><Label>Account Number</Label><Input {...form.register('mortgage.accountNumber')} /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2"><Label>Monthly Payment</Label><Input type="number" {...form.register('mortgage.monthlyPayment')} /></div>
                <div className="grid gap-2"><Label>Interest Rate (%)</Label><Input type="number" step="0.01" {...form.register('mortgage.interestRate')} /></div>
                <div className="grid gap-2"><Label>Loan Balance</Label><Input type="number" {...form.register('mortgage.loanBalance')} /></div>
              </div>
              
              <div className="p-4 border rounded-md bg-slate-50">
                <Label className="mb-2 block font-semibold text-slate-700">Escrow Configuration (Included in Payment)</Label>
                <div className="flex gap-6">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" className="h-4 w-4" {...form.register('mortgage.escrow.includesTax')} />
                    <span className="text-sm">Property Tax</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" className="h-4 w-4" {...form.register('mortgage.escrow.includesInsurance')} />
                    <span className="text-sm">Insurance</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" className="h-4 w-4" {...form.register('mortgage.escrow.includesHoa')} />
                    <span className="text-sm">HOA Fees</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* --- 4. HOA (CONTACT INFO) --- */}
        {activeSection === 'hoa' && (
          <Card>
            <CardHeader><CardTitle>HOA Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
               <div className="flex items-center space-x-4 mb-4">
                  <Label>Is there an HOA?</Label>
                  <RadioGroup defaultValue="no" onValueChange={(val: any) => form.setValue('hoa.hasHoa', val)} className="flex gap-4">
                    <div className="flex items-center space-x-2"><RadioGroupItem value="yes" id="h-yes" /><Label htmlFor="h-yes">Yes</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="no" id="h-no" /><Label htmlFor="h-no">No</Label></div>
                  </RadioGroup>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="grid gap-2"><Label>Fee Amount</Label><Input type="number" {...form.register('hoa.fee')} /></div>
                   <div className="grid gap-2"><Label>Frequency</Label>
                      <Select onValueChange={(val: any) => form.setValue('hoa.frequency', val)} defaultValue="monthly">
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="quarterly">Quarterly</SelectItem>
                            <SelectItem value="annually">Annually</SelectItem>
                        </SelectContent>
                      </Select>
                   </div>
                </div>
                <Separator />
                <Label className="text-muted-foreground">Association Contact</Label>
                <div className="grid grid-cols-3 gap-4">
                   <div className="grid gap-2"><Label>Contact Name</Label><Input placeholder="Mgmt Office" {...form.register('hoa.contactName')} /></div>
                   <div className="grid gap-2"><Label>Phone</Label><Input {...form.register('hoa.contactPhone')} /></div>
                   <div className="grid gap-2"><Label>Email</Label><Input {...form.register('hoa.contactEmail')} /></div>
                </div>
            </CardContent>
          </Card>
        )}

        {/* --- 5. UTILITIES (DETAILED) --- */}
        {activeSection === 'utilities' && (
          <Card>
            <CardHeader>
              <CardTitle>Utility Providers</CardTitle>
              <CardDescription>Track responsibility and company accounts.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
               {utilityFields.fields.map((field, index) => (
                  <div key={field.id} className="p-4 border rounded-lg bg-card">
                     <div className="flex items-center justify-between mb-3">
                        <h4 className="font-bold text-lg">{form.getValues(`utilities.${index}.type`)}</h4>
                        <RadioGroup 
                           defaultValue={field.responsibility}
                           onValueChange={(val: any) => form.setValue(`utilities.${index}.responsibility`, val)}
                           className="flex gap-4"
                        >
                           <div className="flex items-center space-x-2"><RadioGroupItem value="tenant" id={`t-${index}`} /><Label htmlFor={`t-${index}`}>Tenant Pays</Label></div>
                           <div className="flex items-center space-x-2"><RadioGroupItem value="landlord" id={`l-${index}`} /><Label htmlFor={`l-${index}`}>Landlord Pays</Label></div>
                        </RadioGroup>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2"><Label className="text-xs">Provider Name</Label><Input placeholder="e.g. City Water" {...form.register(`utilities.${index}.providerName`)} /></div>
                        <div className="grid gap-2"><Label className="text-xs">Phone / Website</Label><Input placeholder="Contact Info" {...form.register(`utilities.${index}.providerContact`)} /></div>
                     </div>
                  </div>
               ))}
            </CardContent>
          </Card>
        )}

        {/* --- 6. ACCESS (UNCHANGED) --- */}
        {activeSection === 'access' && (
          <Card>
            <CardHeader><CardTitle>Access</CardTitle></CardHeader>
            <CardContent className="space-y-4">
               <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2"><Label>Gate Code</Label><Input {...form.register('access.gateCode')} /></div>
                  <div className="grid gap-2"><Label>Lockbox</Label><Input {...form.register('access.lockboxCode')} /></div>
               </div>
               <div className="grid gap-2"><Label>Notes</Label><Textarea {...form.register('access.notes')} /></div>
            </CardContent>
          </Card>
        )}

        {/* --- 7. TENANTS (NEW) --- */}
        {activeSection === 'tenants' && (
          <Card>
            <CardHeader>
              <div className="flex justify-between">
                 <CardTitle>Tenant Roster</CardTitle>
                 <Button size="sm" onClick={() => tenantFields.append({ firstName: '', lastName: '', email: '', phone: '', leaseStart: '', leaseEnd: '' })}>
                    <Plus className="h-4 w-4 mr-2" /> Add Tenant
                 </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
               {tenantFields.fields.map((field, index) => (
                  <div key={field.id} className="p-4 border rounded-lg relative">
                     <Button size="icon" variant="ghost" className="absolute top-2 right-2 text-red-500" onClick={() => tenantFields.remove(index)}><Trash2 className="h-4 w-4" /></Button>
                     <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="grid gap-2"><Label>First Name</Label><Input {...form.register(`tenants.${index}.firstName`)} /></div>
                        <div className="grid gap-2"><Label>Last Name</Label><Input {...form.register(`tenants.${index}.lastName`)} /></div>
                     </div>
                     <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="grid gap-2"><Label>Email</Label><Input {...form.register(`tenants.${index}.email`)} /></div>
                        <div className="grid gap-2"><Label>Phone</Label><Input {...form.register(`tenants.${index}.phone`)} /></div>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2"><Label>Lease Start</Label><Input type="date" {...form.register(`tenants.${index}.leaseStart`)} /></div>
                        <div className="grid gap-2"><Label>Lease End</Label><Input type="date" {...form.register(`tenants.${index}.leaseEnd`)} /></div>
                     </div>
                  </div>
               ))}
               {tenantFields.fields.length === 0 && <p className="text-center text-muted-foreground py-8">No tenants listed.</p>}
            </CardContent>
          </Card>
        )}

        {/* --- 8. RENT ROLL (NEW) --- */}
        {activeSection === 'rentroll' && (
          <Card>
            <CardHeader>
              <CardTitle>Rent Roll Data</CardTitle>
              <CardDescription>Current active lease financials.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
               <div className="grid gap-2">
                  <Label>Current Lease Status</Label>
                  <Select onValueChange={(val: any) => form.setValue('rentRoll.leaseStatus', val)} defaultValue="vacant">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="active">Active Lease</SelectItem>
                        <SelectItem value="month-to-month">Month-to-Month</SelectItem>
                        <SelectItem value="expiring">Expiring Soon</SelectItem>
                        <SelectItem value="vacant">Vacant</SelectItem>
                    </SelectContent>
                  </Select>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2"><Label>Current Monthly Rent</Label><Input type="number" {...form.register('rentRoll.currentMonthlyRent')} /></div>
                  <div className="grid gap-2"><Label>Security Deposit Held</Label><Input type="number" {...form.register('rentRoll.securityDepositHeld')} /></div>
               </div>
               <div className="grid gap-2"><Label>Next Rent Due Date</Label><Input type="date" {...form.register('rentRoll.nextRentDueDate')} /></div>
            </CardContent>
          </Card>
        )}

        {/* --- 9. MAINTENANCE (NEW) --- */}
        {activeSection === 'maintenance' && (
          <Card>
            <CardHeader>
              <div className="flex justify-between">
                 <CardTitle>Maintenance Log</CardTitle>
                 <Button size="sm" onClick={() => maintenanceFields.append({ description: '', cost: 0, vendor: '', date: '' })}>
                    <Plus className="h-4 w-4 mr-2" /> Add Record
                 </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
               {maintenanceFields.fields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-12 gap-2 items-end border-b pb-4">
                     <div className="col-span-2 grid gap-1"><Label className="text-xs">Date</Label><Input type="date" {...form.register(`maintenance.${index}.date`)} /></div>
                     <div className="col-span-4 grid gap-1"><Label className="text-xs">Description</Label><Input placeholder="Fixed leak" {...form.register(`maintenance.${index}.description`)} /></div>
                     <div className="col-span-3 grid gap-1"><Label className="text-xs">Vendor</Label><Input placeholder="ABC Plumbing" {...form.register(`maintenance.${index}.vendor`)} /></div>
                     <div className="col-span-2 grid gap-1"><Label className="text-xs">Cost</Label><Input type="number" {...form.register(`maintenance.${index}.cost`)} /></div>
                     <div className="col-span-1"><Button size="icon" variant="ghost" className="text-destructive" onClick={() => maintenanceFields.remove(index)}><Trash2 className="h-4 w-4" /></Button></div>
                  </div>
               ))}
               {maintenanceFields.fields.length === 0 && <p className="text-center text-muted-foreground py-8">No maintenance records added.</p>}
            </CardContent>
          </Card>
        )}

        {/* --- 10. VENDORS --- */}
        {activeSection === 'vendors' && (
          <Card>
            <CardHeader>
              <div className="flex justify-between">
                 <CardTitle>Preferred Vendors</CardTitle>
                 <Button size="sm" onClick={() => vendorFields.append({ role: '', name: '', phone: '' })}>
                    <Plus className="h-4 w-4 mr-2" /> Add Vendor
                 </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
               {vendorFields.fields.map((field, index) => (
                 <div key={field.id} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-4 grid gap-1"><Label className="text-xs">Role</Label><Input placeholder="Plumber" {...form.register(`preferredVendors.${index}.role`)} /></div>
                    <div className="col-span-4 grid gap-1"><Label className="text-xs">Name</Label><Input placeholder="Joe Smith" {...form.register(`preferredVendors.${index}.name`)} /></div>
                    <div className="col-span-3 grid gap-1"><Label className="text-xs">Phone</Label><Input placeholder="555-0000" {...form.register(`preferredVendors.${index}.phone`)} /></div>
                    <div className="col-span-1"><Button size="icon" variant="ghost" className="text-destructive" onClick={() => vendorFields.remove(index)}><Trash2 className="h-4 w-4" /></Button></div>
                 </div>
               ))}
               {vendorFields.fields.length === 0 && <p className="text-center text-muted-foreground py-8">No vendors added.</p>}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
    </Form>
  );
}