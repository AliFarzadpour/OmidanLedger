

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm, useFieldArray, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  Building2, DollarSign, Key, Zap, Users, Save, Plus, Trash2, Home, Landmark, 
  FileText, Wrench, UserCheck, CalendarDays, Receipt, Clock, Mail, Phone, ShieldCheck, 
  BookOpen, Bot, Briefcase, Globe, MapPin, CreditCard, ArrowDownCircle, AlertTriangle, Fingerprint, History, Calculator, Loader2, BarChart, Percent
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
import { doc, writeBatch, collection, setDoc, updateDoc, WriteBatch, getDocs, Timestamp } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PropertyFinancials } from './property-financials';
import { generateRulesForProperty } from '@/lib/rule-engine';
import { calculateAmortization } from '@/actions/amortization-actions';

// --- SCHEMA DEFINITION (BUILDING-LEVEL) ---
const propertySchema = z.object({
  name: z.string().min(1, "Nickname is required"),
  type: z.enum(['single-family', 'multi-family', 'condo', 'commercial', 'office']),
  address: z.object({
    street: z.string().min(1, "Street is required"),
    city: z.string().min(1, "City is required"),
    state: z.string().min(2, "State is required"),
    zip: z.string().min(5, "Zip is required"),
  }),
  tenants: z.array(z.object({
      id: z.string().optional(),
      firstName: z.string().min(1, "Required"),
      lastName: z.string().min(1, "Required"),
      email: z.string().email(),
      phone: z.string().optional(),
      status: z.enum(['active', 'past']).default('active'),
      leaseStart: z.string().optional(),
      leaseEnd: z.string().optional(),
      rentAmount: z.coerce.number().optional(),
      deposit: z.coerce.number().optional(),
  })).optional(),
  access: z.object({
    gateCode: z.string().optional(),
    lockboxCode: z.string().optional(),
    notes: z.string().optional(),
  }).optional(),
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
  mortgage: z.object({
    purchasePrice: z.coerce.number().optional(),
    purchaseDate: z.string().optional(),
    hasMortgage: z.enum(['yes', 'no']).optional(),
    lenderName: z.string().optional(),
    accountNumber: z.string().optional(),
    originalLoanAmount: z.coerce.number().optional(),
    loanTerm: z.coerce.number().optional(),
    lenderPhone: z.string().optional(),
    lenderEmail: z.string().optional(),
    principalAndInterest: z.coerce.number().optional(),
    escrowAmount: z.coerce.number().optional(),
    interestRate: z.coerce.number().optional(),
    loanBalance: z.coerce.number().optional(),
    escrow: z.object({
      includesTax: z.boolean().default(false),
      includesInsurance: z.boolean().default(false),
      includesHoa: z.boolean().default(false),
    }).optional(),
  }).optional(),
  taxAndInsurance: z.object({
    propertyTaxAmount: z.coerce.number().optional(),
    taxParcelId: z.string().optional(),
    insuranceProvider: z.string().optional(),
    policyNumber: z.string().optional(),
    annualPremium: z.coerce.number().optional(),
    policyStartDate: z.string().optional(),
    policyEndDate: z.string().optional(),
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
  })).optional(),
  preferredVendors: z.array(z.object({
    id: z.string().optional(),
    role: z.string(),
    name: z.string(),
    phone: z.string(),
  })).optional(),
  depreciation: z.object({
    inServiceDate: z.string().optional(),
    purchasePrice: z.coerce.number().optional(),
    landValue: z.coerce.number().optional(),
    closingCosts: z.coerce.number().optional(),
    improvementBasis: z.coerce.number().optional(),
    method: z.enum(['SL', 'MACRS']).optional(),
    usefulLife: z.coerce.number().optional(),
    depreciableBasis: z.coerce.number().optional(),
    estimatedAnnualDepreciation: z.coerce.number().optional(),
  }).optional(),
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

const DEFAULT_VALUES: Partial<PropertyFormValues> = {
  name: '',
  type: 'single-family',
  address: { street: '', city: '', state: '', zip: '' },
  tenants: [],
  access: { gateCode: '', lockboxCode: '', notes: '' },
  management: { isManaged: 'self', companyName: '', managerName: '', email: '', phone: '', website: '', address: '', feeType: 'percent', feeValue: 0, leasingFee: 0, renewalFee: 0 },
  mortgage: { 
    purchasePrice: 0,
    purchaseDate: '',
    hasMortgage: undefined,
    originalLoanAmount: 0,
    loanTerm: 30,
    escrow: { includesTax: false, includesInsurance: false, includesHoa: false } 
  },
  taxAndInsurance: { propertyTaxAmount: 0, taxParcelId: '', insuranceProvider: '', policyNumber: '', annualPremium: 0, policyStartDate: '', policyEndDate: '' },
  hoa: { hasHoa: 'no', fee: 0, frequency: 'monthly', contactName: '', contactPhone: '', contactEmail: '' },
  utilities: [
    { type: 'Water', responsibility: 'tenant', providerName: '', providerContact: '' },
    { type: 'Electric', responsibility: 'tenant', providerName: '', providerContact: '' },
    { type: 'Gas', responsibility: 'tenant', providerName: '', providerContact: '' },
    { type: 'Trash', responsibility: 'tenant', providerName: '', providerContact: '' },
    { type: 'Internet', responsibility: 'tenant', providerName: '', providerContact: '' },
  ],
  preferredVendors: [{ id: '1', role: 'Handyman', name: '', phone: '' }],
  depreciation: { method: 'SL', usefulLife: 27.5 }
};

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
  const [isCalculating, setIsCalculating] = useState(false);
  const [showPastTenants, setShowPastTenants] = useState(false);

  const isEditMode = !!initialData?.id;

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertySchema),
    defaultValues: useMemo(() => {
      if (!initialData) return DEFAULT_VALUES;
      return {
        ...DEFAULT_VALUES,
        ...initialData,
        utilities: initialData.utilities || DEFAULT_VALUES.utilities,
        preferredVendors: initialData.preferredVendors || DEFAULT_VALUES.preferredVendors,
        tenants: initialData.tenants?.map((t: any) => ({ ...t, status: t.status || 'active' })) || DEFAULT_VALUES.tenants,
        access: initialData.access || DEFAULT_VALUES.access,
        mortgage: { ...DEFAULT_VALUES.mortgage, ...initialData.mortgage },
        management: { ...DEFAULT_VALUES.management, ...initialData.management },
        taxAndInsurance: { ...DEFAULT_VALUES.taxAndInsurance, ...initialData.taxAndInsurance },
        depreciation: { ...DEFAULT_VALUES.depreciation, ...initialData.depreciation },
      }
    }, [initialData])
  });
  
  const watchedDepreciation = useWatch({ control: form.control, name: "depreciation" });
  useEffect(() => {
    if (watchedDepreciation) {
        const basis = (watchedDepreciation.purchasePrice || 0) - (watchedDepreciation.landValue || 0) + (watchedDepreciation.closingCosts || 0) + (watchedDepreciation.improvementBasis || 0);
        const annual = watchedDepreciation.usefulLife ? basis / watchedDepreciation.usefulLife : 0;
        form.setValue('depreciation.depreciableBasis', basis, { shouldDirty: true });
        form.setValue('depreciation.estimatedAnnualDepreciation', annual, { shouldDirty: true });
    }
  }, [watchedDepreciation, form]);

  const vendorFields = useFieldArray({ control: form.control, name: "preferredVendors" });
  const utilityFields = useFieldArray({ control: form.control, name: "utilities" });
  const tenantFields = useFieldArray({ control: form.control, name: "tenants" });

  const activeTenants = useMemo(() => tenantFields.fields.filter((_, index) => form.watch(`tenants.${index}.status`) === 'active'), [tenantFields.fields, form.watch]);
  const pastTenants = useMemo(() => tenantFields.fields.filter((_, index) => form.watch(`tenants.${index}.status`) === 'past'), [tenantFields.fields, form.watch]);
  
  const handleRecalculateBalance = async () => {
    const mortgageData = form.getValues('mortgage');
    if (!mortgageData?.originalLoanAmount || !mortgageData.interestRate || !mortgageData.principalAndInterest || !mortgageData.purchaseDate || !mortgageData.loanTerm) {
        toast({
            variant: "destructive",
            title: "Missing Information",
            description: "Please provide Original Loan Amount, Interest Rate, P&I Payment, Loan Term, and Purchase Date to calculate.",
        });
        return;
    }

    setIsCalculating(true);
    try {
        const result = await calculateAmortization({
            principal: mortgageData.originalLoanAmount,
            annualRate: mortgageData.interestRate,
            principalAndInterest: mortgageData.principalAndInterest,
            loanStartDate: mortgageData.purchaseDate,
            loanTermInYears: mortgageData.loanTerm,
            targetDate: new Date().toISOString(),
        });

        if (result.success && result.currentBalance !== undefined) {
            form.setValue('mortgage.loanBalance', result.currentBalance, { shouldDirty: true });
            toast({
                title: "Balance Calculated",
                description: `Estimated current loan balance is ${result.currentBalance.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}.`,
            });
        } else {
            throw new Error(result.error || "Unknown calculation error.");
        }
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Calculation Failed', description: error.message });
    } finally {
        setIsCalculating(false);
    }
  };

  const onSubmit = async (data: PropertyFormValues) => {
    if (!user || !firestore || !initialData?.id) return;
    setIsSaving(true);
    
    const sanitizedData = { ...data };
    if (sanitizedData.mortgage && sanitizedData.mortgage.hasMortgage === undefined) {
      sanitizedData.mortgage.hasMortgage = null as any; 
    }

    try {
        const propertyRef = doc(firestore, 'properties', initialData.id);
        
        const unitsCollection = collection(firestore, `properties/${initialData.id}/units`);
        const unitsSnap = await getDocs(unitsCollection);
        
        const allUnitsData = unitsSnap.docs.map(doc => {
            const unitData = doc.data();
            const sanitizedUnit: { [key: string]: any } = {};
            for (const key in unitData) {
                if (unitData[key] instanceof Timestamp) {
                    sanitizedUnit[key] = unitData[key].toDate().toISOString();
                } else {
                    sanitizedUnit[key] = unitData[key];
                }
            }
            return { id: doc.id, ...sanitizedUnit };
        });

        const fullPropertyData = {
          ...sanitizedData,
          id: initialData.id,
          isMultiUnit: sanitizedData.type === 'multi-family' || sanitizedData.type === 'commercial' || sanitizedData.type === 'office',
          units: allUnitsData,
        };

        await updateDoc(propertyRef, sanitizedData);
        toast({ title: "Property Updated", description: "Building-level details have been saved." });
        
        await generateRulesForProperty(initialData.id, fullPropertyData, user.uid);
        toast({ title: "Smart Rules Synced", description: "Categorization rules have been updated with the new property info." });
        
        if (onSuccess) onSuccess();

    } catch (error: any) {
        console.error(error);
        toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
        setIsSaving(false);
    }
  };

  const onError = (errors: any) => {
    console.log("Form Errors:", errors);
    const missingFields = [];
    if (errors.utilities) missingFields.push("Utilities configuration");
    if (errors.address) missingFields.push("Address details");

    const desc = missingFields.length > 0 
        ? `Missing required info in: ${missingFields.join(", ")}.` 
        : "Please check all tabs for red error messages.";

    toast({ variant: "destructive", title: "Validation Failed", description: desc });
  };

  const navItems = [
    { id: 'general', label: 'General Info', icon: Building2 },
    { id: 'tenants', label: 'Tenants & Lease', icon: Users },
    { id: 'access', label: 'Access Codes', icon: Fingerprint },
    { id: 'management', label: 'Management Co.', icon: Briefcase },
    { id: 'mortgage', label: 'Mortgage & Loan', icon: Landmark },
    { id: 'depreciation', label: 'Depreciation', icon: BarChart },
    { id: 'tax', label: 'Tax & Insurance', icon: ShieldCheck },
    { id: 'hoa', label: 'HOA', icon: Users },
    { id: 'utilities', label: 'Utilities', icon: Zap },
    { id: 'vendors', label: 'Vendors', icon: Wrench },
    { id: 'accounting', label: 'Automated Accounting', icon: Bot },
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full lg:h-[calc(100vh-120px)]">
      
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
            {form.formState.errors[item.id as keyof PropertyFormValues] && (
                <AlertTriangle className="h-3 w-3 ml-auto text-red-500" />
            )}
          </button>
        ))}
        <Separator className="my-4" />
        <div className="px-1">
           <Button className="w-full bg-green-600 hover:bg-green-700" onClick={form.handleSubmit(onSubmit, onError)} disabled={isSaving}>
             {isSaving ? "Saving..." : <><Save className="mr-2 h-4 w-4" /> {isEditMode ? 'Save Changes' : 'Save & Setup'}</>}
           </Button>
        </div>
      </div>

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
         <Button className="w-full bg-green-600 hover:bg-green-700 shadow-md" onClick={form.handleSubmit(onSubmit, onError)} disabled={isSaving}>
             {isSaving ? "Saving..." : <><Save className="mr-2 h-4 w-4" /> {isEditMode ? 'Save Changes' : 'Save & Setup'}</>}
         </Button>
      </div>

      <div className="flex-1 w-full h-auto lg:h-full lg:overflow-y-auto pr-1 pb-20 lg:pb-10">
        
        {activeSection === 'vendors' && (
            <p className="text-center text-muted-foreground py-10">The central vendor management page is under development.</p>
        )}

        {activeSection === 'general' && (
          <Card>
            <CardHeader><CardTitle>General Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                  <Label>Nickname</Label>
                  <Input {...form.register('name')} />
                  {form.formState.errors.name && <span className="text-red-500 text-xs">Required</span>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>Type</Label>
                    <Controller
                        name="type"
                        control={form.control}
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="single-family">Single Family</SelectItem>
                                    <SelectItem value="multi-family">Multi-Family</SelectItem>
                                    <SelectItem value="condo">Condo</SelectItem>
                                    <SelectItem value="commercial">Commercial</SelectItem>
                                    <SelectItem value="office">Office</SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                    />
                </div>
              </div>
              <div className="grid gap-2">
                  <Label>Address</Label>
                  <Input placeholder="123 Main St" {...form.register('address.street')} />
                  {form.formState.errors.address?.street && <span className="text-red-500 text-xs">Required</span>}
              </div>
              <div className="grid grid-cols-3 gap-4">
                 <div className="grid gap-2">
                    <Input placeholder="City" {...form.register('address.city')} />
                    {form.formState.errors.address?.city && <span className="text-red-500 text-xs">Required</span>}
                 </div>
                 <div className="grid gap-2">
                    <Input placeholder="State" {...form.register('address.state')} />
                    {form.formState.errors.address?.state && <span className="text-red-500 text-xs">Required</span>}
                 </div>
                 <div className="grid gap-2">
                    <Input placeholder="Zip" {...form.register('address.zip')} />
                    {form.formState.errors.address?.zip && <span className="text-red-500 text-xs">Required</span>}
                 </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {activeSection === 'tenants' && (
            <div className="space-y-6">
                <Card>
                    <CardHeader><CardTitle>Active Tenants</CardTitle><CardDescription>Manage current residents for this property.</CardDescription></CardHeader>
                    <CardContent className="space-y-4">
                        {activeTenants.map((field, index) => {
                            const originalIndex = tenantFields.fields.findIndex(f => f.id === field.id);
                            return (
                                <div key={field.id} className="p-4 bg-slate-50 rounded-lg border space-y-3">
                                  <div className="grid grid-cols-2 gap-4">
                                      <div className="space-y-1"><Label className="text-xs">First Name *</Label><Input {...form.register(`tenants.${originalIndex}.firstName`)} /></div>
                                      <div className="space-y-1"><Label className="text-xs">Last Name *</Label><Input {...form.register(`tenants.${originalIndex}.lastName`)} /></div>
                                  </div>
                                   <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1"><Label className="text-xs">Email *</Label><Input type="email" {...form.register(`tenants.${originalIndex}.email`)} /></div>
                                        <div className="space-y-1"><Label className="text-xs">Phone</Label><Input {...form.register(`tenants.${originalIndex}.phone`)} /></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                                        <div className="space-y-1"><Label className="text-xs">Lease Start</Label><Input type="date" {...form.register(`tenants.${originalIndex}.leaseStart`)} /></div>
                                        <div className="space-y-1"><Label className="text-xs">Lease End</Label><Input type="date" {...form.register(`tenants.${originalIndex}.leaseEnd`)} /></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1"><Label className="text-xs">Rent Amount ($)</Label><Input type="number" {...form.register(`tenants.${originalIndex}.rentAmount`, { valueAsNumber: true })} /></div>
                                        <div className="space-y-1"><Label className="text-xs">Deposit Held ($)</Label><Input type="number" {...form.register(`tenants.${originalIndex}.deposit`, { valueAsNumber: true })} /></div>
                                    </div>
                                  <div className="space-y-1"><Label className="text-xs">Status</Label>
                                    <Controller
                                        name={`tenants.${originalIndex}.status`}
                                        control={form.control}
                                        render={({ field }) => (
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="active">Active</SelectItem>
                                                    <SelectItem value="past">Past</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                  </div>
                                </div>
                            );
                        })}
                        {activeTenants.length === 0 && <p className="text-sm text-center text-muted-foreground py-4">No active tenants.</p>}
                        <Button type="button" variant="outline" className="w-full border-dashed" onClick={() => tenantFields.append({ firstName: '', lastName: '', email: '', status: 'active', rentAmount: 0, deposit: 0 })}><Plus className="mr-2 h-4 w-4" /> Add Tenant</Button>
                    </CardContent>
                </Card>

                {pastTenants.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><History className="h-5 w-5 text-muted-foreground" /> Past Tenants</CardTitle>
                            <CardDescription>Archived resident records for historical reference.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                           {pastTenants.map((field, index) => {
                             const originalIndex = tenantFields.fields.findIndex(f => f.id === field.id);
                             return (
                                <div key={field.id} className="p-3 bg-slate-50 rounded-md border flex justify-between items-center">
                                    <div>
                                        <p className="font-medium">{form.watch(`tenants.${originalIndex}.firstName`)} {form.watch(`tenants.${originalIndex}.lastName`)}</p>
                                        <p className="text-xs text-muted-foreground">{form.watch(`tenants.${originalIndex}.email`)}</p>
                                    </div>
                                    <Controller
                                        name={`tenants.${originalIndex}.status`}
                                        control={form.control}
                                        render={({ field }) => (
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <SelectTrigger className="bg-white h-8 w-[100px]"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="active">Active</SelectItem>
                                                    <SelectItem value="past">Past</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </div>
                             )
                           })}
                        </CardContent>
                    </Card>
                )}
            </div>
        )}

        {activeSection === 'access' && (
          <Card>
            <CardHeader><CardTitle>Access Information</CardTitle><CardDescription>Gate codes, lockbox details, and access notes.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>Front Gate Code</Label><Input {...form.register('access.gateCode')} /></div>
                <div className="grid gap-2"><Label>Lockbox Code</Label><Input {...form.register('access.lockboxCode')} /></div>
              </div>
              <div className="grid gap-2"><Label>Access Notes</Label><Textarea placeholder="e.g., 'Key is under the mat', 'Call before arriving'" {...form.register('access.notes')} /></div>
            </CardContent>
          </Card>
        )}

        {activeSection === 'management' && (
          <Card>
            <CardHeader><CardTitle>Property Management</CardTitle><CardDescription>Who manages the day-to-day operations?</CardDescription></CardHeader>
            <CardContent className="space-y-6">
               <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <Label>Management Style</Label>
                  <Controller
                      name="management.isManaged"
                      control={form.control}
                      render={({ field }) => (
                          <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4">
                            <div className="flex items-center space-x-2"><RadioGroupItem value="self" id="self" /><Label htmlFor="self">Self-Managed</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="professional" id="pro" /><Label htmlFor="pro">Professional</Label></div>
                          </RadioGroup>
                      )}
                    />
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
                       <div className="grid gap-2"><Label className="flex items-center gap-1"><Globe className="h-3 w-3"/> Website</Label><Input placeholder="www.abc-mgmt.com" {...form.register('management.website')} /></div>
                       <div className="grid gap-2"><Label className="flex items-center gap-1"><MapPin className="h-3 w-3"/> Mailing Address</Label><Input placeholder="PO Box 123" {...form.register('management.address')} /></div>
                    </div>
                    <div className="p-4 bg-slate-50 border rounded-lg">
                       <Label className="mb-2 block font-semibold text-slate-700">Fee Structure</Label>
                       <div className="grid grid-cols-12 gap-4 mb-3">
                          <div className="col-span-4"><Label className="text-xs">Monthly Fee</Label>
                            <Controller
                                name="management.feeType"
                                control={form.control}
                                render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent><SelectItem value="percent">% of Rent</SelectItem><SelectItem value="flat">Flat Fee</SelectItem></SelectContent>
                                    </Select>
                                )}
                            />
                          </div>
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
                <Controller
                    name="mortgage.hasMortgage"
                    control={form.control}
                    render={({ field }) => (
                        <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4">
                            <div className="flex items-center space-x-2"><RadioGroupItem value="yes" id="m-yes" /><Label htmlFor="m-yes">Yes</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="no" id="m-no" /><Label htmlFor="m-no">No</Label></div>
                        </RadioGroup>
                    )}
                />
              </div>
              {form.watch('mortgage.hasMortgage') === 'yes' && (
                <>
                  <div className="p-4 border rounded-lg bg-blue-50/20 space-y-4">
                    <Label className="font-bold text-blue-800">Loan Origination Details</Label>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2"><Label>Original Loan Amount</Label><Input type="number" {...form.register('mortgage.originalLoanAmount')} placeholder="e.g., 250000" /></div>
                        <div className="grid gap-2"><Label>Loan Term (Years)</Label><Input type="number" {...form.register('mortgage.loanTerm')} placeholder="e.g., 30" /></div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2"><Label>Lender Name</Label><Input {...form.register('mortgage.lenderName')} /></div>
                    <div className="grid gap-2"><Label>Account Number</Label><Input {...form.register('mortgage.accountNumber')} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label>Principal & Interest</Label>
                        <Input type="number" {...form.register('mortgage.principalAndInterest')} placeholder="e.g. 1500" />
                    </div>
                    <div className="grid gap-2">
                        <Label>Monthly Escrow Amount</Label>
                        <Input type="number" {...form.register('mortgage.escrowAmount')} placeholder="e.g. 450" />
                    </div>
                  </div>
                   <p className="text-xs text-muted-foreground -mt-4">Your total payment to the lender is the sum of Principal/Interest and Escrow.</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2"><Label>Interest Rate (%)</Label><Input type="number" step="0.01" {...form.register('mortgage.interestRate')} /></div>
                    <div className="grid gap-2"><Label>Current Loan Balance</Label>
                        <div className="flex items-center gap-2">
                            <Input type="number" {...form.register('mortgage.loanBalance')} />
                            <Button type="button" variant="secondary" onClick={handleRecalculateBalance} disabled={isCalculating} className="gap-2">
                                {isCalculating ? <Loader2 className="h-4 w-4 animate-spin"/> : <Calculator className="h-4 w-4"/>}
                                Calc
                            </Button>
                        </div>
                    </div>
                  </div>
                  <div className="p-4 border rounded-md bg-slate-50">
                    <Label className="mb-2 block font-semibold text-slate-700">This escrow amount is for:</Label>
                    <div className="flex gap-6">
                      <div className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4" {...form.register('mortgage.escrow.includesTax')} /><span className="text-sm">Property Tax</span></div>
                      <div className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4" {...form.register('mortgage.escrow.includesInsurance')} /><span className="text-sm">Insurance</span></div>
                      <div className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4" {...form.register('mortgage.escrow.includesHoa')} /><span className="text-sm">HOA Fees</span></div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {activeSection === 'depreciation' && (
          <Card>
            <CardHeader><CardTitle>Depreciation Details</CardTitle><CardDescription>Enter details to estimate annual depreciation for tax purposes.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>In-Service Date (Closing Date)</Label><Input type="date" {...form.register('depreciation.inServiceDate')} /></div>
                    <div className="space-y-2"><Label>Purchase Price</Label><Input type="number" {...form.register('depreciation.purchasePrice')} /></div>
                </div>
                <div className="p-4 bg-slate-50 border rounded-lg">
                    <Label className="font-semibold text-slate-700 mb-2 block">Basis Calculation</Label>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2"><Label>Land Value</Label><Input type="number" {...form.register('depreciation.landValue')} /></div>
                        <div className="space-y-2"><Label>Closing Costs</Label><Input type="number" {...form.register('depreciation.closingCosts')} /></div>
                    </div>
                    <div className="space-y-2 mt-4"><Label>Capital Improvements</Label><Input type="number" {...form.register('depreciation.improvementBasis')} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Method</Label>
                        <Controller
                            name="depreciation.method"
                            control={form.control}
                            render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="SL">Straight-Line (SL)</SelectItem>
                                        <SelectItem value="MACRS">MACRS</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                        />
                    </div>
                    <div className="space-y-2"><Label>Useful Life (Years)</Label><Input type="number" step="0.5" {...form.register('depreciation.usefulLife')} /></div>
                </div>
                 <Separator />
                 <div className="grid grid-cols-2 gap-4 p-4 bg-blue-50/50 border border-blue-100 rounded-lg">
                    <div className="space-y-1">
                        <Label className="text-blue-800">Depreciable Basis</Label>
                        <Input disabled readOnly value={form.watch('depreciation.depreciableBasis')?.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-blue-800">Est. Annual Depreciation</Label>
                        <Input disabled readOnly value={form.watch('depreciation.estimatedAnnualDepreciation')?.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} />
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
                <div className="grid gap-2">
                  <Label>Annual Premium ($)</Label>
                  <Input type="number" {...form.register('taxAndInsurance.annualPremium')} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2"><Label>Policy Start Date</Label><Input type="date" {...form.register('taxAndInsurance.policyStartDate')} /></div>
                  <div className="grid gap-2"><Label>Policy End Date</Label><Input type="date" {...form.register('taxAndInsurance.policyEndDate')} /></div>
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
                  <Controller
                    name="hoa.hasHoa"
                    control={form.control}
                    render={({ field }) => (
                        <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4">
                            <div className="flex items-center space-x-2"><RadioGroupItem value="yes" id="h-yes" /><Label htmlFor="h-yes">Yes</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="no" id="h-no" /><Label htmlFor="h-no">No</Label></div>
                        </RadioGroup>
                    )}
                  />
                </div>
                {form.watch('hoa.hasHoa') === 'yes' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="grid gap-2"><Label>Fee Amount</Label><Input type="number" {...form.register('hoa.fee')} /></div>
                       <div className="grid gap-2"><Label>Frequency</Label>
                          <Controller
                            name="hoa.frequency"
                            control={form.control}
                            render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="monthly">Monthly</SelectItem>
                                        <SelectItem value="quarterly">Quarterly</SelectItem>
                                        <SelectItem value="semi-annually">Semi-Annually</SelectItem>
                                        <SelectItem value="annually">Annually</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                          />
                       </div>
                    </div>
                    <Separator />
                    <div className="grid grid-cols-3 gap-4">
                       <div className="grid gap-2"><Label>Contact Name</Label><Input placeholder="Mgmt Office" {...form.register('hoa.contactName')} /></div>
                       <div className="grid gap-2"><Label>Phone</Label><Input {...form.register('hoa.contactPhone')} /></div>
                       <div className="grid gap-2"><Label>Email</Label><Input {...form.register('hoa.contactEmail')} /></div>
                    </div>
                  </>
                )}
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
                       <TableCell>
                           <Controller
                                name={`utilities.${index}.responsibility`}
                                control={form.control}
                                render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="tenant">Tenant Pays</SelectItem>
                                            <SelectItem value="landlord">Landlord Pays</SelectItem>
                                        </SelectContent>
                                    </Select>
                                )}
                            />
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
