'use client';

import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUser, useFirestore } from '@/firebase';
import { doc, writeBatch, collection, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Home, DollarSign, Building } from 'lucide-react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const quickSchema = z.object({
  name: z.string().min(1, "Nickname is required"),
  type: z.enum(['single-family', 'multi-family', 'condo', 'commercial', 'office']),
  address: z.object({
    street: z.string().min(1, "Street is required"),
    city: z.string().min(1, "City is required"),
    state: z.string().min(2, "State is required"),
    zip: z.string().min(5, "Zip is required"),
  }),
  bedrooms: z.coerce.number().optional(),
  bathrooms: z.coerce.number().optional(),
  squareFootage: z.coerce.number().optional(),
  numberOfUnits: z.coerce.number().optional(),
  targetRent: z.coerce.number().optional(),
  securityDeposit: z.coerce.number().optional(),
});

const generateUnitBatch = (firestore: any, propertyRef: any, count: number, userId: string, baseData: any) => {
  const units = [];
  for (let i = 1; i <= count; i++) {
    const unitRef = doc(collection(propertyRef, 'units'));
    units.push({
      ref: unitRef,
      data: {
        userId,
        unitNumber: `${100 + i}`,
        status: 'vacant',
        // Granular Fields
        bedrooms: baseData.bedrooms || 1, 
        bathrooms: baseData.bathrooms || 1,
        sqft: Math.floor(baseData.squareFootage / count) || 0,
        amenities: [], // e.g., ["Balcony", "Updated Appliances"]
        financials: {
          rent: baseData.targetRent / count || 0,
          deposit: baseData.securityDeposit / count || 0,
        },
        createdAt: new Date().toISOString(),
      }
    });
  }
  return units;
};


export function QuickPropertyForm({ onSuccess }: { onSuccess: () => void }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm({
    resolver: zodResolver(quickSchema),
    defaultValues: {
      name: '',
      type: 'single-family' as const,
      address: { street: '', city: '', state: '', zip: '' },
      bedrooms: 0,
      bathrooms: 0,
      squareFootage: 0,
      numberOfUnits: 10,
      targetRent: 0,
      securityDeposit: 0,
    }
  });

  const propertyType = form.watch('type');
  const isMultiUnitType = propertyType === 'multi-family' || propertyType === 'commercial';

  const onSubmit = async (data: any) => {
    if (!user || !firestore) return;
    setIsSaving(true);
  
    const batch = writeBatch(firestore);
    const timestamp = new Date().toISOString();
    const propertyRef = doc(collection(firestore, 'properties'));
    
    // --- 1. CORE ACCOUNTING GENERATOR ---
    const accountingMap: any = { utilities: {} };
    const createAccount = (name: string, type: string, subtype: string) => {
      const ref = doc(collection(firestore, 'accounts'));
      batch.set(ref, {
        userId: user.uid,
        name, type, subtype,
        balance: 0,
        isSystemAccount: true,
        propertyId: propertyRef.id,
        createdAt: timestamp
      });
      return ref.id;
    };
  
    // Assets, Liabilities, Income, Expenses (Preserved from your code)
    accountingMap.assetAccount = createAccount(`Property - ${data.name}`, 'Asset', 'Fixed Asset');
    accountingMap.utilities.deposits = createAccount(`Util Deposits - ${data.name}`, 'Asset', 'Other Current Asset');
    accountingMap.securityDepositAccount = createAccount(`Tenant Deposits - ${data.name}`, 'Liability', 'Other Current Liability');
    accountingMap.accountsPayableAccount = createAccount(`Accounts Payable - ${data.name}`, 'Liability', 'Accounts Payable');
    accountingMap.incomeAccount = createAccount(`Rent - ${data.name}`, 'Income', 'Rental Income');
    accountingMap.lateFeeAccount = createAccount(`Late Fees - ${data.name}`, 'Income', 'Other Income');
    accountingMap.expenseAccount = createAccount(`Maint/Ops - ${data.name}`, 'Expense', 'Repairs & Maintenance');
    accountingMap.taxAccount = createAccount(`Prop Taxes - ${data.name}`, 'Expense', 'Taxes');
    accountingMap.insuranceAccount = createAccount(`Insurance - ${data.name}`, 'Expense', 'Insurance');
    accountingMap.managementFeeAccount = createAccount(`Mgmt Fees - ${data.name}`, 'Expense', 'Property Management');
    accountingMap.utilities.water = createAccount(`Water - ${data.name}`, 'Expense', 'Utilities');
    accountingMap.utilities.electric = createAccount(`Electric - ${data.name}`, 'Expense', 'Utilities');
    accountingMap.utilities.gas = createAccount(`Gas - ${data.name}`, 'Expense', 'Utilities');
    accountingMap.utilities.trash = createAccount(`Trash - ${data.name}`, 'Expense', 'Utilities');
    accountingMap.utilities.internet = createAccount(`Internet - ${data.name}`, 'Expense', 'Utilities');
  
    // --- 2. BRANCHING LOGIC ---
    const isMultiUnit = data.type === 'multi-family' || data.type === 'commercial' || data.type === 'office';
    const propertyData = {
      userId: user.uid,
      ...data,
      isMultiUnit,
      financials: { targetRent: data.targetRent, securityDeposit: data.securityDeposit },
      mortgage: { hasMortgage: 'no' }, 
      management: { isManaged: 'self' },
      tenants: [], 
      createdAt: timestamp,
      accounting: accountingMap
    };

    // Save the Main Property (The Hub)
    batch.set(propertyRef, propertyData);
  
    // --- 3. AUTO-PILOT: SUBCOLLECTION GENERATION ---
    if (isMultiUnit) {
      const numUnits = data.numberOfUnits || 1;
      const unitsToCreate = generateUnitBatch(firestore, propertyRef, numUnits, user.uid, data);
      unitsToCreate.forEach(unit => {
        batch.set(unit.ref, unit.data);
      });
    }
  
    // Use a non-blocking commit with detailed error handling
    batch.commit()
      .then(() => {
        toast({ 
          title: isMultiUnit ? "Central Hub Created" : "Property Added", 
          description: isMultiUnit ? `Building and ${data.numberOfUnits || 1} units are ready.` : "Property and 16 ledgers created." 
        });
        onSuccess();
      })
      .catch((error) => {
        console.error("Firestore batch commit failed:", error);
        
        // Create and emit the detailed error
        const permissionError = new FirestorePermissionError({
          path: propertyRef.path, // We report the error on the main property doc
          operation: 'create',
          requestResourceData: propertyData,
        });
        errorEmitter.emit('permission-error', permissionError);

        // Also show a generic toast to the user
        toast({ variant: "destructive", title: "Error", description: "Failed to save property due to a permission issue." });
      })
      .finally(() => {
        setIsSaving(false);
      });
  };

  return (
    <div className="space-y-6 p-4">
      <div className="bg-blue-50 p-4 rounded-lg flex gap-3 items-start border border-blue-100">
        <Home className="h-5 w-5 text-blue-600 mt-0.5" />
        <div>
          <h3 className="font-medium text-blue-900">Quick Setup</h3>
          <p className="text-sm text-blue-700">Enter the basics to get started. We will generate your Chart of Accounts automatically.</p>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Nickname</Label>
              <Input placeholder="e.g. The Lake House" {...form.register('name')} />
              {form.formState.errors.name && <p className="text-red-500 text-xs">Required</p>}
            </div>
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select onValueChange={(val:any) => form.setValue('type', val)} defaultValue="single-family">
                 <SelectTrigger><SelectValue /></SelectTrigger>
                 <SelectContent>
                    <SelectItem value="single-family">Single Family</SelectItem>
                    <SelectItem value="multi-family">Multi-Family</SelectItem>
                    <SelectItem value="condo">Condo</SelectItem>
                    <SelectItem value="commercial">Commercial</SelectItem>
                    <SelectItem value="office">Office</SelectItem>
                 </SelectContent>
              </Select>
            </div>
        </div>

        {!isMultiUnitType ? (
          <>
            <div className="grid grid-cols-3 gap-2">
                <div className="grid gap-1"><Label className="text-xs">Bedrooms</Label><Input type="number" {...form.register('bedrooms')} /></div>
                <div className="grid gap-1"><Label className="text-xs">Bathrooms</Label><Input type="number" {...form.register('bathrooms')} /></div>
                <div className="grid gap-1"><Label className="text-xs">Sq. Ft.</Label><Input type="number" {...form.register('squareFootage')} /></div>
            </div>
             <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Target Rent</Label>
                <Input type="number" placeholder="2000" {...form.register('targetRent')} />
              </div>
              <div className="grid gap-2">
                <Label>Security Deposit</Label>
                <Input type="number" placeholder="2000" {...form.register('securityDeposit')} />
              </div>
            </div>
          </>
        ) : (
           <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <Label className="flex items-center gap-2 font-semibold mb-2">
                    <Building className="h-4 w-4 text-slate-500"/>
                    Building Configuration
                </Label>
                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label className="text-xs text-muted-foreground">Number of Units</Label>
                        <Input type="number" placeholder="e.g., 4" {...form.register('numberOfUnits')} />
                    </div>
                    <div className="grid gap-2">
                        <Label className="text-xs text-muted-foreground">Total Square Footage</Label>
                        <Input type="number" placeholder="e.g., 10000" {...form.register('squareFootage')} />
                    </div>
                </div>
                <p className="text-xs text-slate-600 mt-2">
                    Enter the number of units and total building size. We'll automatically distribute the square footage.
                </p>
            </div>
        )}

        <div className="grid gap-2">
          <Label>Street Address</Label>
          <Input placeholder="123 Main St" {...form.register('address.street')} />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="grid gap-2"><Label>City</Label><Input {...form.register('address.city')} /></div>
          <div className="grid gap-2"><Label>State</Label><Input {...form.register('address.state')} /></div>
          <div className="grid gap-2"><Label>Zip</Label><Input {...form.register('address.zip')} /></div>
        </div>
        
      </div>

      <div className="flex justify-end pt-4">
        <Button onClick={form.handleSubmit(onSubmit)} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 w-full">
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Create Property"}
        </Button>
      </div>
    </div>
  );
}

    