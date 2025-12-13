'use client';

import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  Building2, DollarSign, Key, Zap, Users, Save, Plus, Trash2, Home, Landmark, 
  FileText, Wrench, UserCheck, CalendarDays, Receipt, Clock, Mail, Phone, ShieldCheck, 
  BookOpen, Bot, ArrowRight 
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
import { doc, writeBatch, collection } from 'firebase/firestore'; // Import writeBatch
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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
  }),
  mortgage: z.object({
    purchasePrice: z.coerce.number().optional(),
    purchaseDate: z.string().optional(),
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
  taxAndInsurance: z.object({
    propertyTaxAmount: z.coerce.number().optional(),
    taxParcelId: z.string().optional(),
    insuranceProvider: z.string().optional(),
    policyNumber: z.string().optional(),
    annualPremium: z.coerce.number().optional(),
    renewalDate: z.string().optional(),
  }),
  hoa: z.object({
    hasHoa: z.enum(['yes', 'no']),
    fee: z.coerce.number().optional(),
    frequency: z.enum(['monthly', 'quarterly', 'semi-annually', 'annually']).optional(),
    contactName: z.string().optional(),
    contactPhone: z.string().optional(),
    contactEmail: z.string().optional(),
  }),
  utilities: z.array(z.object({
    type: z.string(), 
    responsibility: z.enum(['tenant', 'landlord']),
    providerName: z.string().optional(),
    providerContact: z.string().optional(),
  })),
  access: z.object({
    gateCode: z.string().optional(),
    lockboxCode: z.string().optional(),
    notes: z.string().optional(),
  }),
  tenants: z.array(z.object({
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().email(),
    phone: z.string().optional(),
    leaseStart: z.string().optional(),
    leaseEnd: z.string().optional(),
    rentAmount: z.coerce.number(),
    rentDueDate: z.coerce.number().min(1).max(31).default(1),
    lateFeeAmount: z.coerce.number().optional(),
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
        purchasePrice: 0,
        purchaseDate: '',
        hasMortgage: 'no' as const,
        lenderName: '', 
        escrow: { includesTax: false, includesInsurance: false, includesHoa: false } 
      },
      taxAndInsurance: { propertyTaxAmount: 0, taxParcelId: '', insuranceProvider: '', policyNumber: '', annualPremium: 0, renewalDate: '' },
      hoa: { hasHoa: 'no' as const, fee: 0, frequency: 'monthly' as const, contactName: '', contactPhone: '', contactEmail: '' },
      utilities: [
        { type: 'Water', responsibility: 'tenant' as const, providerName: '', providerContact: '' },
        { type: 'Electric', responsibility: 'tenant' as const, providerName: '', providerContact: '' },
        { type: 'Gas', responsibility: 'tenant' as const, providerName: '', providerContact: '' },
        { type: 'Trash', responsibility: 'tenant' as const, providerName: '', providerContact: '' },
        { type: 'Internet', responsibility: 'tenant' as const, providerName: '', providerContact: '' },
      ],
      access: { gateCode: '', lockboxCode: '', notes: '' },
      tenants: [],
      preferredVendors: [{ role: 'Handyman', name: '', phone: '' }]
    }
  });

  const vendorFields = useFieldArray({ control: form.control, name: "preferredVendors" });
  const tenantFields = useFieldArray({ control: form.control, name: "tenants" });
  const utilityFields = useFieldArray({ control: form.control, name: "utilities" });

  // --- AUTOMATED BATCH CREATION LOGIC ---
  const onSubmit = async (data: any) => {
    if (!user || !firestore) return;
    setIsSaving(true);

    try {
      // 1. Initiate Batch
      const batch = writeBatch(firestore);
      
      // 2. Create References for "The Property Suite"
      const propertyRef = doc(collection(firestore, 'properties'));
      const incomeRef = doc(collection(firestore, 'accounts'));
      const expenseRef = doc(collection(firestore, 'accounts'));
      const assetRef = doc(collection(firestore, 'accounts'));
      
      // 3. Prepare Account Objects (The "Suite")
      const timestamp = new Date().toISOString();
      const accountsToCreate = [
        {
          ref: incomeRef,
          data: {
            userId: user.uid,
            name: `Rent - ${data.name}`,
            type: 'Income',
            subtype: 'Rental Income',
            balance: 0,
            isSystemAccount: true, // Flag to prevent accidental deletion
            createdAt: timestamp
          }
        },
        {
          ref: expenseRef,
          data: {
            userId: user.uid,
            name: `Maint/Ops - ${data.name}`,
            type: 'Expense',
            subtype: 'Property Expense',
            balance: 0,
            isSystemAccount: true,
            createdAt: timestamp
          }
        },
        {
          ref: assetRef,
          data: {
            userId: user.uid,
            name: `Property - ${data.name}`,
            type: 'Asset',
            subtype: 'Fixed Asset',
            balance: data.mortgage?.purchasePrice || 0, // Initial value
            isSystemAccount: true,
            createdAt: timestamp
          }
        }
      ];

      // 4. Handle Mortgage Liability (Conditional)
      let liabilityAccountId = null;
      if (data.mortgage.hasMortgage === 'yes') {
        const liabilityRef = doc(collection(firestore, 'accounts'));
        accountsToCreate.push({
          ref: liabilityRef,
          data: {
            userId: user.uid,
            name: `Mortgage - ${data.name}`,
            type: 'Liability',
            subtype: 'Long Term Liability',
            balance: data.mortgage?.loanBalance || 0,
            isSystemAccount: true,
            createdAt: timestamp
          }
        });
        liabilityAccountId = liabilityRef.id;
      }

      // 5. Add Accounts to Batch
      accountsToCreate.forEach(acc => batch.set(acc.ref, acc.data));

      // 6. Add Property to Batch (With Links!)
      batch.set(propertyRef, {
        userId: user.uid,
        ...data,
        createdAt: timestamp,
        // THE GOLDEN LINK: Connecting Operations to Accounting
        accounting: {
          incomeAccountId: incomeRef.id,
          expenseAccountId: expenseRef.id,
          assetAccountId: assetRef.id,
          liabilityAccountId: liabilityAccountId
        }
      });

      // 7. Commit!
      await batch.commit();

      toast({ 
        title: "Property & Books Created", 
        description: `Successfully set up ${data.name} and created ${accountsToCreate.length} ledger accounts.` 
      });
      
      if (onSuccess) onSuccess();

    } catch (error: any) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const navItems = [
    { id: 'general', label: 'General Info', icon: Building2 },
    { id: 'accounting', label: 'Automated Accounting', icon: Bot }, // UPDATED LABEL
    { id: 'financials', label: 'Rent Targets', icon: DollarSign },
    { id: 'mortgage', label: 'Mortgage & Loan', icon: Landmark },
    { id: 'tax', label: 'Tax & Insurance', icon: ShieldCheck },
    { id: 'hoa', label: 'HOA', icon: Users },
    { id: 'utilities', label: 'Utilities', icon: Zap },
    { id: 'access', label: 'Access & Keys', icon: Key },
    { id: 'tenants', label: 'Tenant Roster', icon: UserCheck },
    { id: 'rentroll', label: 'Rent Roll', icon: FileText },
    { id: 'maintenance', label: 'Maintenance', icon: Wrench },
    { id: 'vendors', label: 'Vendors', icon: Users },
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full lg:h-[calc(100vh-120px)]">
      {/* SIDEBAR */}
      <div className="hidden lg:flex lg:w-64 flex-shrink-0 flex-col gap-2 h-full overflow-y-auto pb-4">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveSection(item.id)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors text-left",
              activeSection === item.id 
                ? "bg-primary text-primary-foreground shadow-sm" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </button>
        ))}
        <Separator className="my-4" />
        <div className="px-1">
           <Button 
             className="w-full bg-green-600 hover:bg-green-700" 
             onClick={form.handleSubmit(onSubmit)}
             disabled={isSaving}
           >
             {isSaving ? "Creating..." : <><Save className="mr-2 h-4 w-4" /> Save & Setup</>}
           </Button>
        </div>
      </div>

      {/* MOBILE NAV */}
      <div className="lg:hidden w-full space-y-4">
         <div className="p-4 bg-muted/50 rounded-lg border">
            <Label className="mb-2 block">Navigate Form</Label>
            <Select value={activeSection} onValueChange={setActiveSection}>
              <SelectTrigger className="w-full bg-white"><SelectValue placeholder="Select section" /></SelectTrigger>
              <SelectContent>
                {navItems.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    <div className="flex items-center gap-2"><item.icon className="h-4 w-4" />{item.label}</div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
         </div>
         <Button className="w-full bg-green-600 hover:bg-green-700 shadow-md" onClick={form.handleSubmit(onSubmit)} disabled={isSaving}>
             {isSaving ? "Creating..." : <><Save className="mr-2 h-4 w-4" /> Save & Setup</>}
         </Button>
      </div>

      {/* CONTENT AREA */}
      <div className="flex-1 w-full h-auto lg:h-full lg:overflow-y-auto pr-1 pb-20 lg:pb-10">
        
        {/* --- 1. GENERAL --- */}
        {activeSection === 'general' && (
          <Card>
            <CardHeader><CardTitle>General Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2"><Label>Nickname</Label><Input {...form.register('name')} /></div>
              <div className="grid gap-2"><Label>Type</Label>
                <Select onValueChange={(v:any)=>form.setValue('type',v)} defaultValue="single-family">
                   <SelectTrigger><SelectValue/></SelectTrigger>
                   <SelectContent>
                      <SelectItem value="single-family">Single Family</SelectItem>
                      <SelectItem value="multi-family">Multi-Family</SelectItem>
                      <SelectItem value="condo">Condo</SelectItem>
                      <SelectItem value="commercial">Commercial</SelectItem>
                   </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2"><Label>Address</Label><Input placeholder="123 Main St" {...form.register('address.street')} /></div>
              <div className="grid grid-cols-3 gap-4">
                 <Input placeholder="City" {...form.register('address.city')} />
                 <Input placeholder="State" {...form.register('address.state')} />
                 <Input placeholder="Zip" {...form.register('address.zip')} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* --- ACCOUNTING (NEW: AUTO-PILOT PREVIEW) --- */}
        {activeSection === 'accounting' && (
          <Card className="border-blue-200 bg-blue-50/30">
            <CardHeader>
              <div className="flex items-center gap-2">
                 <Bot className="h-6 w-6 text-blue-600" />
                 <CardTitle>Automated Bookkeeping</CardTitle>
              </div>
              <CardDescription>
                We will automatically create separate ledgers for this property to keep your books organized.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
               <div className="grid gap-4">
                  
                  {/* Visualizing the "Suite" */}
                  <div className="flex items-center justify-between p-3 bg-white border rounded-lg shadow-sm">
                     <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-full"><DollarSign className="h-4 w-4 text-green-700"/></div>
                        <div>
                           <p className="font-medium text-sm">Income Ledger</p>
                           <p className="text-xs text-muted-foreground">For Rent & Fees</p>
                        </div>
                     </div>
                     <div className="text-sm font-mono text-slate-600">Rent - {form.watch('name') || 'Property'}</div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-white border rounded-lg shadow-sm">
                     <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 rounded-full"><Wrench className="h-4 w-4 text-red-700"/></div>
                        <div>
                           <p className="font-medium text-sm">Expense Ledger</p>
                           <p className="text-xs text-muted-foreground">For Repairs & Ops</p>
                        </div>
                     </div>
                     <div className="text-sm font-mono text-slate-600">Maint/Ops - {form.watch('name') || 'Property'}</div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-white border rounded-lg shadow-sm">
                     <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-full"><Home className="h-4 w-4 text-blue-700"/></div>
                        <div>
                           <p className="font-medium text-sm">Asset Ledger</p>
                           <p className="text-xs text-muted-foreground">Property Value</p>
                        </div>
                     </div>
                     <div className="text-sm font-mono text-slate-600">Property - {form.watch('name') || 'Property'}</div>
                  </div>

                  {form.watch('mortgage.hasMortgage') === 'yes' && (
                    <div className="flex items-center justify-between p-3 bg-white border rounded-lg shadow-sm">
                       <div className="flex items-center gap-3">
                          <div className="p-2 bg-orange-100 rounded-full"><Landmark className="h-4 w-4 text-orange-700"/></div>
                          <div>
                             <p className="font-medium text-sm">Liability Ledger</p>
                             <p className="text-xs text-muted-foreground">Mortgage Principal</p>
                          </div>
                       </div>
                       <div className="text-sm font-mono text-slate-600">Mortgage - {form.watch('name') || 'Property'}</div>
                    </div>
                  )}

               </div>
               
               <div className="flex items-start gap-2 p-4 bg-yellow-50 text-yellow-800 rounded-md text-xs">
                  <BookOpen className="h-4 w-4 mt-0.5 shrink-0" />
                  <p>
                     <strong>How AI uses this:</strong> When you download transactions later, our AI will look for 
                     "{form.watch('name')}" in the description and automatically categorize it into these specific accounts.
                  </p>
               </div>
            </CardContent>
          </Card>
        )}

        {/* --- 2. FINANCIALS --- */}
        {activeSection === 'financials' && (
          <Card>
            <CardHeader><CardTitle>Market Targets</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Target Monthly Rent</Label><Input type="number" {...form.register('financials.targetRent')} /></div>
              <div className="grid gap-2"><Label>Security Deposit Req.</Label><Input type="number" {...form.register('financials.securityDeposit')} /></div>
            </CardContent>
          </Card>
        )}

        {/* --- 3. MORTGAGE --- */}
        {activeSection === 'mortgage' && (
          <Card>
            <CardHeader><CardTitle>Loan & Purchase Information</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 border rounded-lg">
                  <div className="grid gap-2"><Label>Purchase Price</Label><Input type="number" {...form.register('mortgage.purchasePrice')} /></div>
                  <div className="grid gap-2"><Label>Purchase Date</Label><Input type="date" {...form.register('mortgage.purchaseDate')} /></div>
              </div>
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
                <Label className="mb-2 block font-semibold text-slate-700">Escrow Configuration</Label>
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

        {/* --- 4. TAX & INSURANCE --- */}
        {activeSection === 'tax' && (
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Property Tax</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>Tax Parcel ID</Label><Input placeholder="Found on tax bill" {...form.register('taxAndInsurance.taxParcelId')} /></div>
                <div className="grid gap-2"><Label>Annual Tax Amount</Label><Input type="number" {...form.register('taxAndInsurance.propertyTaxAmount')} /></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Home Insurance</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2"><Label>Insurance Provider</Label><Input placeholder="State Farm, Geico..." {...form.register('taxAndInsurance.insuranceProvider')} /></div>
                  <div className="grid gap-2"><Label>Policy Number</Label><Input {...form.register('taxAndInsurance.policyNumber')} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2"><Label>Annual Premium ($)</Label><Input type="number" {...form.register('taxAndInsurance.annualPremium')} /></div>
                  <div className="grid gap-2"><Label>Renewal Date</Label><Input type="date" {...form.register('taxAndInsurance.renewalDate')} /></div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* --- 5. HOA --- */}
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
                            <SelectItem value="semi-annually">Semi-Annually</SelectItem>
                            <SelectItem value="annually">Annually</SelectItem>
                        </SelectContent>
                      </Select>
                   </div>
                </div>
                <Separator />
                <div className="grid grid-cols-3 gap-4">
                   <div className="grid gap-2"><Label>Contact Name</Label><Input placeholder="Mgmt Office" {...form.register('hoa.contactName')} /></div>
                   <div className="grid gap-2"><Label>Phone</Label><Input {...form.register('hoa.contactPhone')} /></div>
                   <div className="grid gap-2"><Label>Email</Label><Input {...form.register('hoa.contactEmail')} /></div>
                </div>
            </CardContent>
          </Card>
        )}

        {/* --- 6. UTILITIES --- */}
        {activeSection === 'utilities' && (
          <Card>
            <CardHeader>
              <CardTitle>Utility Responsibility</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
               <Table>
                 <TableHeader>
                   <TableRow>
                     <TableHead className="w-[100px]">Utility</TableHead>
                     <TableHead className="w-[150px]">Responsibility</TableHead>
                     <TableHead>Provider Name</TableHead>
                     <TableHead>Contact / Acct #</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {utilityFields.fields.map((field, index) => (
                     <TableRow key={field.id}>
                       <TableCell className="font-medium">{form.getValues(`utilities.${index}.type`)}</TableCell>
                       <TableCell>
                          <Select 
                            onValueChange={(val:any) => form.setValue(`utilities.${index}.responsibility`, val)}
                            defaultValue={field.responsibility}
                          >
                             <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
                             <SelectContent>
                                <SelectItem value="tenant">Tenant Pays</SelectItem>
                                <SelectItem value="landlord">Landlord Pays</SelectItem>
                             </SelectContent>
                          </Select>
                       </TableCell>
                       <TableCell><Input className="h-8" placeholder="Provider" {...form.register(`utilities.${index}.providerName`)} /></TableCell>
                       <TableCell><Input className="h-8" placeholder="Phone/Acct" {...form.register(`utilities.${index}.providerContact`)} /></TableCell>
                     </TableRow>
                   ))}
                 </TableBody>
               </Table>
            </CardContent>
          </Card>
        )}

        {/* --- 7. ACCESS --- */}
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

        {/* --- 8. TENANTS --- */}
        {activeSection === 'tenants' && (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                 <div>
                    <CardTitle>Tenant Roster</CardTitle>
                    <CardDescription>Active tenants for invoicing.</CardDescription>
                 </div>
                 <Button size="sm" onClick={() => tenantFields.append({ firstName: '', lastName: '', email: '', phone: '', leaseStart: '', leaseEnd: '', rentAmount: 0, rentDueDate: 1 })}>
                    <Plus className="h-4 w-4 mr-2" /> Add Tenant
                 </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
               {tenantFields.fields.map((field, index) => (
                  <div key={field.id} className="p-4 border rounded-lg bg-slate-50 relative">
                     <Button size="icon" variant="ghost" className="absolute top-2 right-2 text-destructive hover:bg-destructive/10" onClick={() => tenantFields.remove(index)}>
                        <Trash2 className="h-4 w-4" />
                     </Button>
                     
                     <div className="grid grid-cols-2 gap-4 mb-4 pr-8">
                        <div className="grid gap-2">
                           <Label className="text-xs">First Name</Label>
                           <Input className="bg-white" {...form.register(`tenants.${index}.firstName`)} />
                        </div>
                        <div className="grid gap-2">
                           <Label className="text-xs">Last Name</Label>
                           <Input className="bg-white" {...form.register(`tenants.${index}.lastName`)} />
                        </div>
                     </div>

                     <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="grid gap-2">
                           <Label className="text-xs flex items-center gap-1"><Mail className="h-3 w-3"/> Email (Invoice)</Label>
                           <Input className="bg-white" {...form.register(`tenants.${index}.email`)} />
                        </div>
                        <div className="grid gap-2">
                           <Label className="text-xs flex items-center gap-1"><Phone className="h-3 w-3"/> Phone</Label>
                           <Input className="bg-white" {...form.register(`tenants.${index}.phone`)} />
                        </div>
                     </div>

                     <Separator className="mb-4" />

                     <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="grid gap-2">
                           <Label className="text-xs font-semibold text-blue-700">Monthly Rent ($)</Label>
                           <Input type="number" className="bg-white border-blue-200" {...form.register(`tenants.${index}.rentAmount`)} />
                        </div>
                        <div className="grid gap-2">
                           <Label className="text-xs font-semibold text-blue-700">Due Day</Label>
                           <Input type="number" max={31} min={1} className="bg-white border-blue-200" {...form.register(`tenants.${index}.rentDueDate`)} />
                        </div>
                        <div className="grid gap-2">
                           <Label className="text-xs text-red-700">Late Fee ($)</Label>
                           <Input type="number" className="bg-white border-red-200" {...form.register(`tenants.${index}.lateFeeAmount`)} />
                        </div>
                     </div>

                     <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                           <Label className="text-xs">Lease Start</Label>
                           <Input type="date" className="bg-white" {...form.register(`tenants.${index}.leaseStart`)} />
                        </div>
                        <div className="grid gap-2">
                           <Label className="text-xs">Lease End</Label>
                           <Input type="date" className="bg-white" {...form.register(`tenants.${index}.leaseEnd`)} />
                        </div>
                     </div>

                  </div>
               ))}
               {tenantFields.fields.length === 0 && <p className="text-center text-muted-foreground py-8">No tenants added yet.</p>}
            </CardContent>
          </Card>
        )}

        {/* --- 9. RENT ROLL --- */}
        {activeSection === 'rentroll' && (
          <Card>
            <CardHeader>
              <CardTitle>Rent Roll</CardTitle>
              <CardDescription>Live summary of lease performance.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
               <div className="bg-slate-100 p-4 border-b flex justify-between items-center text-sm">
                  <span className="font-medium">Total Monthly Revenue:</span>
                  <span className="font-bold text-green-700 text-lg">
                    ${form.watch('tenants')?.reduce((acc: number, t: any) => acc + (parseFloat(t.rentAmount)||0), 0).toLocaleString()}
                  </span>
               </div>
               <Table>
                 <TableHeader>
                   <TableRow>
                     <TableHead>Tenant Name</TableHead>
                     <TableHead>Lease Term</TableHead>
                     <TableHead>Status</TableHead>
                     <TableHead className="text-right">Monthly Rent</TableHead>
                     <TableHead className="text-right">Late Fee</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {form.watch('tenants')?.map((tenant: any, i: number) => (
                     <TableRow key={i}>
                       <TableCell className="font-medium">{tenant.firstName} {tenant.lastName}</TableCell>
                       <TableCell className="text-xs text-muted-foreground">{tenant.leaseStart} - {tenant.leaseEnd}</TableCell>
                       <TableCell><span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold">Active</span></TableCell>
                       <TableCell className="text-right">${tenant.rentAmount}</TableCell>
                       <TableCell className="text-right text-red-500">${tenant.lateFeeAmount || 0}</TableCell> 
                     </TableRow>
                   ))}
                   {(!form.watch('tenants') || form.watch('tenants')?.length === 0) && (
                      <TableRow><TableCell colSpan={5} className="text-center h-24 text-muted-foreground">No active leases found.</TableCell></TableRow>
                   )}
                 </TableBody>
               </Table>
            </CardContent>
          </Card>
        )}

        {/* --- 10. MAINTENANCE --- */}
        {activeSection === 'maintenance' && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div><CardTitle>Maintenance Data Sheet</CardTitle><CardDescription>Synced from Transactions.</CardDescription></div>
              <Button size="sm" variant="outline"><Receipt className="h-4 w-4 mr-2" /> Log Expense</Button>
            </CardHeader>
            <CardContent className="p-0">
               <div className="p-8 text-center border-b bg-slate-50/50">
                  <Wrench className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                  <p className="text-sm text-slate-600 max-w-sm mx-auto">This sheet will automatically populate with maintenance transactions.</p>
               </div>
               <Table>
                 <TableHeader>
                   <TableRow>
                     <TableHead>Date</TableHead>
                     <TableHead>Description</TableHead>
                     <TableHead>Vendor</TableHead>
                     <TableHead className="text-right">Cost</TableHead>
                     <TableHead className="text-right">Status</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                    <TableRow><TableCell className="text-muted-foreground italic" colSpan={5}>No maintenance records found.</TableCell></TableRow>
                 </TableBody>
               </Table>
            </CardContent>
          </Card>
        )}

        {/* --- 11. VENDORS --- */}
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
  );
}