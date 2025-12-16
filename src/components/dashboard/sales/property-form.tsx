'use client';

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  Building2, DollarSign, Key, Zap, Users, Save, Plus, Trash2, Home, Landmark, 
  FileText, Wrench, UserCheck, CalendarDays, Receipt, Clock, Mail, Phone, ShieldCheck, 
  BookOpen, Bot, Briefcase, Globe, MapPin, CreditCard, ArrowDownCircle 
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
import { doc, writeBatch, collection, setDoc, updateDoc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// --- TYPES ---
type Property = {
  id: string;
  name: string;
  type: 'single-family' | 'multi-family' | 'condo' | 'commercial';
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  [key: string]: any; 
};

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
  management: z.object({
    isManaged: z.enum(['self', 'professional']),
    companyName: z.string().optional(),
    managerName: z.string().optional(),
    website: z.string().optional(),
    address: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    feeType: z.enum(['percent', 'flat']).optional(),
    feeValue: z.coerce.number().optional(),
    leasingFee: z.coerce.number().optional(),
    renewalFee: z.coerce.number().optional(),
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
    id: z.string().optional(), 
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
    id: z.string().optional(),
    role: z.string(),
    name: z.string(),
    phone: z.string(),
  })).optional(),
  accounting: z.object({
    assetAccount: z.string().optional(),
    incomeAccount: z.string().optional(),
    lateFeeAccount: z.string().optional(),
    expenseAccount: z.string().optional(),
    managementFeeAccount: z.string().optional(),
    liabilityAccount: z.string().optional(),
    securityDepositAccount: z.string().optional(),
    interestAccount: z.string().optional(),
    taxAccount: z.string().optional(),
    insuranceAccount: z.string().optional(),
    hoaAccount: z.string().optional(),
    utilities: z.object({
        water: z.string().optional(),
        electric: z.string().optional(),
        gas: z.string().optional(),
        trash: z.string().optional(),
        internet: z.string().optional(),
        deposits: z.string().optional(),
    }).optional(),
  }).optional(),
});

type PropertyFormValues = z.infer<typeof propertySchema>;

// --- MAIN COMPONENT ---
export function PropertyForm({ 
  onSuccess, 
  initialData,
  defaultTab = "general"
}: { 
  onSuccess?: () => void, 
  initialData?: any,
  defaultTab?: string 
}) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState(defaultTab);
  const [isSaving, setIsSaving] = useState(false);

  const [currentPropertyId, setCurrentPropertyId] = useState<string | null>(initialData?.id || null);

  const isEditMode = !!currentPropertyId;

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertySchema),
    defaultValues: initialData || {
      name: '',
      type: 'single-family',
      address: { street: '', city: '', state: '', zip: '' },
      financials: { targetRent: 0, securityDeposit: 0 },
      management: { isManaged: 'self', companyName: '', managerName: '', email: '', phone: '', website: '', address: '', feeType: 'percent', feeValue: 0, leasingFee: 0, renewalFee: 0 },
      mortgage: { 
        purchasePrice: 0,
        purchaseDate: '',
        hasMortgage: 'no', 
        lenderName: '', 
        escrow: { includesTax: false, includesInsurance: false, includesHoa: false } 
      },
      taxAndInsurance: { propertyTaxAmount: 0, taxParcelId: '', insuranceProvider: '', policyNumber: '', annualPremium: 0, renewalDate: '' },
      hoa: { hasHoa: 'no', fee: 0, frequency: 'monthly', contactName: '', contactPhone: '', contactEmail: '' },
      utilities: [
        { type: 'Water', responsibility: 'tenant', providerName: '', providerContact: '' },
        { type: 'Electric', responsibility: 'tenant', providerName: '', providerContact: '' },
        { type: 'Gas', responsibility: 'tenant', providerName: '', providerContact: '' },
        { type: 'Trash', responsibility: 'tenant', providerName: '', providerContact: '' },
        { type: 'Internet', responsibility: 'tenant', providerName: '', providerContact: '' },
      ],
      access: { gateCode: '', lockboxCode: '', notes: '' },
      tenants: [],
      preferredVendors: [{ id: '1', role: 'Handyman', name: '', phone: '' }]
    }
  });

  useEffect(() => {
    if (initialData) {
      form.reset(initialData);
      setCurrentPropertyId(initialData.id);
    }
  }, [initialData, form]);

  const vendorFields = useFieldArray({ control: form.control, name: "preferredVendors" });
  const tenantFields = useFieldArray({ control: form.control, name: "tenants" });
  const utilityFields = useFieldArray({ control: form.control, name: "utilities" });

  const onSubmit = async (data: PropertyFormValues) => {
    if (!user || !firestore) return;
    setIsSaving(true);
    
    try {
        if (isEditMode && currentPropertyId) {
            const propertyRef = doc(firestore, 'properties', currentPropertyId);
            await updateDoc(propertyRef, data);
            toast({ title: "Property Updated", description: "Changes saved successfully." });
        } else {
            const batch = writeBatch(firestore);
            const timestamp = new Date().toISOString();
            const propertyRef = doc(collection(firestore, 'properties'));
            
            const accountingMap: any = { utilities: {} };

            const createAccount = (name: string, type: string, subtype: string, balance: number = 0) => {
                const ref = doc(collection(firestore, 'accounts'));
                batch.set(ref, { userId: user.uid, name, type, subtype, balance, isSystemAccount: true, propertyId: propertyRef.id, createdAt: timestamp });
                return ref.id;
            };

            accountingMap.assetAccount = createAccount(`Property - ${data.name}`, 'Asset', 'Fixed Asset', data.mortgage?.purchasePrice || 0);
            accountingMap.utilities.deposits = createAccount(`Util Deposits - ${data.name}`, 'Asset', 'Other Current Asset');

            if (data.financials.securityDeposit > 0) {
                accountingMap.securityDepositAccount = createAccount(`Tenant Deposits - ${data.name}`, 'Liability', 'Other Current Liability', 0);
            }
            if (data.mortgage.hasMortgage === 'yes') {
                accountingMap.liabilityAccount = createAccount(`Mortgage - ${data.name}`, 'Liability', 'Long Term Liability', data.mortgage?.loanBalance || 0);
            }

            accountingMap.incomeAccount = createAccount(`Rent - ${data.name}`, 'Income', 'Rental Income');
            accountingMap.lateFeeAccount = createAccount(`Late Fees - ${data.name}`, 'Income', 'Other Income');

            accountingMap.expenseAccount = createAccount(`Maint/Ops - ${data.name}`, 'Expense', 'Repairs & Maintenance');
            accountingMap.taxAccount = createAccount(`Prop Taxes - ${data.name}`, 'Expense', 'Taxes');
            accountingMap.insuranceAccount = createAccount(`Insurance - ${data.name}`, 'Expense', 'Insurance');
            
            if (data.management.isManaged === 'professional') {
                accountingMap.managementFeeAccount = createAccount(`Mgmt Fees - ${data.name}`, 'Expense', 'Property Management');
            }

            if (data.mortgage.hasMortgage === 'yes') {
                accountingMap.interestAccount = createAccount(`Mtg Interest - ${data.name}`, 'Expense', 'Interest Expense');
            }
            if (data.hoa.hasHoa === 'yes') {
                accountingMap.hoaAccount = createAccount(`HOA Fees - ${data.name}`, 'Expense', 'Dues & Subscriptions');
            }

            accountingMap.utilities.water = createAccount(`Water - ${data.name}`, 'Expense', 'Utilities');
            accountingMap.utilities.electric = createAccount(`Electric - ${data.name}`, 'Expense', 'Utilities');
            accountingMap.utilities.gas = createAccount(`Gas - ${data.name}`, 'Expense', 'Utilities');
            accountingMap.utilities.trash = createAccount(`Trash - ${data.name}`, 'Expense', 'Utilities');
            accountingMap.utilities.internet = createAccount(`Internet - ${data.name}`, 'Expense', 'Utilities');

            batch.set(propertyRef, {
                userId: user.uid,
                ...data,
                createdAt: timestamp,
                accounting: accountingMap
            });

            await batch.commit();

            setCurrentPropertyId(propertyRef.id);

            toast({ title: "Property Suite Created", description: `Generated property record and full Chart of Accounts for ${data.name}.` });
        }
        
        if (onSuccess) onSuccess();

    } catch (error: any) {
        console.error(error);
        toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
        setIsSaving(false);
    }
  };

  const navItems = [
    { id: 'tenants', label: 'Tenants', icon: UserCheck },
    { id: 'rentroll', label: 'Lease Summary', icon: ArrowDownCircle },
    { id: 'maintenance', label: 'Maintenance', icon: Wrench },
    { id: 'vendors', label: 'Vendors', icon: Users },
    { id: 'general', label: 'General Info', icon: Building2 },
    { id: 'financials', label: 'Rent Targets', icon: DollarSign },
    { id: 'management', label: 'Management Co.', icon: Briefcase },
    { id: 'mortgage', label: 'Mortgage & Loan', icon: Landmark },
    { id: 'tax', label: 'Tax & Insurance', icon: ShieldCheck },
    { id: 'hoa', label: 'HOA', icon: Users },
    { id: 'utilities', label: 'Utilities', icon: Zap },
    { id: 'access', label: 'Access & Keys', icon: Key },
    { id: 'accounting', label: 'Automated Accounting', icon: Bot },
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
           <Button className="w-full bg-green-600 hover:bg-green-700" onClick={form.handleSubmit(onSubmit)} disabled={isSaving}>
             {isSaving ? "Saving..." : <><Save className="mr-2 h-4 w-4" /> {isEditMode ? 'Save Changes' : 'Save & Setup'}</>}
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
             {isSaving ? "Saving..." : <><Save className="mr-2 h-4 w-4" /> {isEditMode ? 'Save Changes' : 'Save & Setup'}</>}
         </Button>
      </div>

      {/* CONTENT AREA */}
      <div className="flex-1 w-full h-auto lg:h-full lg:overflow-y-auto pr-1 pb-20 lg:pb-10">
        
        {activeSection === 'tenants' && (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                 <div>
                    <CardTitle>Tenants</CardTitle>
                    <CardDescription>Current residents and lease details. Add multiple for co-signers.</CardDescription>
                 </div>
                 <Button size="sm" onClick={() => tenantFields.append({ id: '', firstName: '', lastName: '', email: '', phone: '', leaseStart: '', leaseEnd: '', rentAmount: 0, rentDueDate: 1, lateFeeAmount: 0 })}>
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
                         <div className="grid gap-2"><Label className="text-xs">First Name</Label><Input className="bg-white" {...form.register(`tenants.${index}.firstName`)} /></div>
                         <div className="grid gap-2"><Label className="text-xs">Last Name</Label><Input className="bg-white" {...form.register(`tenants.${index}.lastName`)} /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                         <div className="grid gap-2"><Label className="text-xs flex items-center gap-1"><Mail className="h-3 w-3"/> Email (Invoice)</Label><Input className="bg-white" {...form.register(`tenants.${index}.email`)} /></div>
                         <div className="grid gap-2"><Label className="text-xs flex items-center gap-1"><Phone className="h-3 w-3"/> Phone</Label><Input className="bg-white" {...form.register(`tenants.${index}.phone`)} /></div>
                      </div>
                      
                      <Separator className="mb-4" />

                      <div className="grid grid-cols-3 gap-4 mb-4">
                         <div className="grid gap-2">
                            <Label className="text-xs font-semibold text-blue-700">Rent Portion ($)</Label>
                            <Input type="number" className="bg-white border-blue-200" placeholder="Their share" {...form.register(`tenants.${index}.rentAmount`)} />
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
                         <div className="grid gap-2"><Label className="text-xs">Lease Start</Label><Input type="date" className="bg-white" {...form.register(`tenants.${index}.leaseStart`)} /></div>
                         <div className="grid gap-2"><Label className="text-xs">Lease End</Label><Input type="date" className="bg-white" {...form.register(`tenants.${index}.leaseEnd`)} /></div>
                      </div>
                  </div>
               ))}
               {tenantFields.fields.length === 0 && <p className="text-center text-muted-foreground py-8">No tenants added yet.</p>}
            </CardContent>
          </Card>
        )}
        
        {activeSection === 'rentroll' && (
          <Card>
            <CardHeader>
              <CardTitle>Lease Summary & Collections</CardTitle>
              <CardDescription>Report of actual rent collected from transaction history.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
               <div className="p-6 text-center border-b bg-slate-50/50">
                  <ArrowDownCircle className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-medium text-slate-900">No transactions yet.</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                     This report will automatically populate with payment history once you log transactions.
                  </p>
               </div>
               
               <Table>
                 <TableHeader>
                   <TableRow>
                     <TableHead>Date Paid</TableHead>
                     <TableHead>Tenant / Description</TableHead>
                     <TableHead>Bank Account</TableHead>
                     <TableHead className="text-right">Amount Collected</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                    <TableRow>
                       <TableCell colSpan={4} className="h-24 text-center text-muted-foreground italic">
                          Waiting for first payment...
                       </TableCell>
                    </TableRow>
                 </TableBody>
               </Table>
            </CardContent>
          </Card>
        )}

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
                 <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Vendor</TableHead><TableHead className="text-right">Cost</TableHead><TableHead className="text-right">Status</TableHead></TableRow></TableHeader>
                 <TableBody><TableRow><TableCell className="text-muted-foreground italic" colSpan={5}>No maintenance records found.</TableCell></TableRow></TableBody>
               </Table>
            </CardContent>
          </Card>
        )}
        
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
        
        {activeSection === 'financials' && (
          <Card>
            <CardHeader><CardTitle>Market Targets</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Target Monthly Rent</Label><Input type="number" {...form.register('financials.targetRent')} /></div>
              <div className="grid gap-2"><Label>Security Deposit Req.</Label><Input type="number" {...form.register('financials.securityDeposit')} /></div>
            </CardContent>
          </Card>
        )}

        {activeSection === 'management' && (
          <Card>
            <CardHeader><CardTitle>Property Management</CardTitle><CardDescription>Who manages the day-to-day operations?</CardDescription></CardHeader>
            <CardContent className="space-y-6">
               <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <Label>Management Style</Label>
                  <RadioGroup defaultValue="self" onValueChange={(val: any) => form.setValue('management.isManaged', val)} className="flex gap-4">
                    <div className="flex items-center space-x-2"><RadioGroupItem value="self" id="self" /><Label htmlFor="self">Self-Managed</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="professional" id="pro" /><Label htmlFor="pro">Professional</Label></div>
                  </RadioGroup>
               </div>

               {form.watch('management.isManaged') === 'professional' && (
                 <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                    <Separator />
                    <div className="grid grid-cols-2 gap-4">
                       <div className="grid gap-2"><Label>Company Name</Label><Input placeholder="ABC Property Mgmt" {...form.register('management.companyName')} /></div>
                       <div className="grid gap-2"><Label>Manager Name</Label><Input placeholder="John Doe" {...form.register('management.managerName')} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="grid gap-2"><Label>Email</Label><Input placeholder="contact@abc.com" {...form.register('management.email')} /></div>
                       <div className="grid gap-2"><Label>Phone</Label><Input placeholder="(555) 555-5555" {...form.register('management.phone')} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="grid grid-cols-2 gap-4">
                       <div className="grid gap-2"><Label className="flex items-center gap-1"><Globe className="h-3 w-3"/> Website</Label><Input placeholder="www.abc-mgmt.com" {...form.register('management.website')} /></div>
                       <div className="grid gap-2"><Label className="flex items-center gap-1"><MapPin className="h-3 w-3"/> Mailing Address</Label><Input placeholder="PO Box 123" {...form.register('management.address')} /></div>
                    </div>
                    <div className="p-4 bg-slate-50 border rounded-lg">
                       <Label className="mb-2 block font-semibold text-slate-700">Fee Structure</Label>
                       <div className="grid grid-cols-12 gap-4 mb-3">
                          <div className="col-span-4"><Label className="text-xs">Monthly Fee</Label><Select onValueChange={(val:any) => form.setValue('management.feeType', val)} defaultValue="percent"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="percent">% of Rent</SelectItem><SelectItem value="flat">Flat Fee</SelectItem></SelectContent></Select></div>
                          <div className="col-span-8"><Label className="text-xs">Value</Label><Input type="number" placeholder="10" {...form.register('management.feeValue')} /></div>
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                          <div className="grid gap-2"><Label className="text-xs text-muted-foreground">Leasing Fee</Label><div className="relative"><DollarSign className="absolute left-2 top-2.5 h-3 w-3 text-muted-foreground"/><Input type="number" className="pl-7" {...form.register('management.leasingFee')} /></div></div>
                          <div className="grid gap-2"><Label className="text-xs text-muted-foreground">Renewal Fee</Label><div className="relative"><DollarSign className="absolute left-2 top-2.5 h-3 w-3 text-muted-foreground"/><Input type="number" className="pl-7" {...form.register('management.renewalFee')} /></div></div>
                       </div>
                    </div>
                 </div>
               )}
            </CardContent>
          </Card>
        )}

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
                  <div className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4" {...form.register('mortgage.escrow.includesTax')} /><span className="text-sm">Property Tax</span></div>
                  <div className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4" {...form.register('mortgage.escrow.includesInsurance')} /><span className="text-sm">Insurance</span></div>
                  <div className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4" {...form.register('mortgage.escrow.includesHoa')} /><span className="text-sm">HOA Fees</span></div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
                        <SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="quarterly">Quarterly</SelectItem><SelectItem value="semi-annually">Semi-Annually</SelectItem><SelectItem value="annually">Annually</SelectItem></SelectContent>
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

        {activeSection === 'utilities' && (
          <Card>
            <CardHeader><CardTitle>Utility Responsibility</CardTitle></CardHeader>
            <CardContent className="p-0">
               <Table>
                 <TableHeader><TableRow><TableHead className="w-[100px]">Utility</TableHead><TableHead className="w-[150px]">Responsibility</TableHead><TableHead>Provider Name</TableHead><TableHead>Contact / Acct #</TableHead></TableRow></TableHeader>
                 <TableBody>
                   {utilityFields.fields.map((field, index) => (
                     <TableRow key={field.id}>
                       <TableCell className="font-medium">{form.getValues(`utilities.${index}.type`)}</TableCell>
                       <TableCell><Select onValueChange={(val:any) => form.setValue(`utilities.${index}.responsibility`, val)} defaultValue={field.responsibility}><SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="tenant">Tenant Pays</SelectItem><SelectItem value="landlord">Landlord Pays</SelectItem></SelectContent></Select></TableCell>
                       <TableCell><Input className="h-8" placeholder="Provider" {...form.register(`utilities.${index}.providerName`)} /></TableCell>
                       <TableCell><Input className="h-8" placeholder="Phone/Acct" {...form.register(`utilities.${index}.providerContact`)} /></TableCell>
                     </TableRow>
                   ))}
                 </TableBody>
               </Table>
            </CardContent>
          </Card>
        )}

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
        
        {activeSection === 'accounting' && (
          <Card className="border-blue-200 bg-blue-50/30">
            <CardHeader>
              <div className="flex items-center gap-2"><Bot className="h-6 w-6 text-blue-600" /><CardTitle>Automated Bookkeeping</CardTitle></div>
              <CardDescription>We will create the following ledgers for <strong>{form.watch('name') || 'this property'}</strong>.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
               <div className="p-2 bg-white border rounded text-xs flex justify-between"><span className="font-semibold text-blue-700">Assets</span><span>Property Value, Utility Deposits</span></div>
               <div className="p-2 bg-white border rounded text-xs flex justify-between"><span className="font-semibold text-orange-700">Liabilities</span><span>Mortgage, Tenant Deposits</span></div>
               <div className="p-2 bg-white border rounded text-xs flex justify-between"><span className="font-semibold text-green-700">Income</span><span>Rent Revenue, Late Fees</span></div>
               <div className="p-2 bg-white border rounded text-xs">
                  <span className="font-semibold text-red-700 block mb-1">Expenses</span>
                  <ul className="list-disc list-inside text-slate-600 grid grid-cols-2 gap-1">
                     <li>Maintenance</li><li>Property Tax</li><li>Insurance</li>
                     {form.watch('management.isManaged') === 'professional' && <li>Mgmt Fees</li>}
                     <li>Water</li><li>Electric</li><li>Gas</li><li>Trash</li><li>Internet</li>
                     {form.watch('mortgage.hasMortgage') === 'yes' && <li>Mortgage Interest</li>}
                     {form.watch('hoa.hasHoa') === 'yes' && <li>HOA Fees</li>}
                  </ul>
               </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
I am omitting the other sections for brevity as they are unchanged, but ensure you keep them in your file!

[object Object]