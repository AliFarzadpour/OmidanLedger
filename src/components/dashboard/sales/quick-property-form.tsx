'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUser, useFirestore } from '@/firebase';
import { doc, writeBatch, collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Home, DollarSign } from 'lucide-react';

// Simple Schema - Just the basics
const quickSchema = z.object({
  name: z.string().min(1, "Nickname is required"),
  address: z.object({
    street: z.string().min(1, "Street is required"),
    city: z.string().min(1, "City is required"),
    state: z.string().min(2, "State is required"),
    zip: z.string().min(5, "Zip is required"),
  }),
  targetRent: z.coerce.number().min(0),
});

export function QuickPropertyForm({ onSuccess }: { onSuccess: () => void }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm({
    resolver: zodResolver(quickSchema),
    defaultValues: {
      name: '',
      address: { street: '', city: '', state: '', zip: '' },
      targetRent: 0,
    }
  });

  const onSubmit = async (data: any) => {
    if (!user || !firestore) return;
    setIsSaving(true);

    try {
      // BATCH WRITE: Create Property + 15 Ledgers instantly
      const batch = writeBatch(firestore);
      const timestamp = new Date().toISOString();
      const propertyRef = doc(collection(firestore, 'properties'));
      
      const accountingMap: any = { utilities: {} };

      // Helper to create ledger accounts
      const createAccount = (name: string, type: string, subtype: string) => {
        const ref = doc(collection(firestore, 'accounts'));
        batch.set(ref, {
          userId: user.uid,
          name: name,
          type: type,
          subtype: subtype,
          balance: 0,
          isSystemAccount: true,
          propertyId: propertyRef.id,
          createdAt: timestamp
        });
        return ref.id;
      };

      // 1. Create the Ledgers
      accountingMap.assetAccount = createAccount(`Property - ${data.name}`, 'Asset', 'Fixed Asset');
      accountingMap.incomeAccount = createAccount(`Rent - ${data.name}`, 'Income', 'Rental Income');
      accountingMap.expenseAccount = createAccount(`Maint/Ops - ${data.name}`, 'Expense', 'Repairs & Maintenance');
      // ... (We create the rest silently so they are ready for later)
      accountingMap.securityDepositAccount = createAccount(`Tenant Deposits - ${data.name}`, 'Liability', 'Other Current Liability');
      accountingMap.taxAccount = createAccount(`Prop Taxes - ${data.name}`, 'Expense', 'Taxes');
      accountingMap.insuranceAccount = createAccount(`Insurance - ${data.name}`, 'Expense', 'Insurance');

      // 2. Save Property
      batch.set(propertyRef, {
        userId: user.uid,
        ...data,
        // Set defaults for the complex tabs so they aren't null later
        financials: { targetRent: data.targetRent, securityDeposit: 0 },
        mortgage: { hasMortgage: 'no' }, 
        management: { isManaged: 'self' },
        tenants: [], 
        createdAt: timestamp,
        accounting: accountingMap
      });

      await batch.commit();
      toast({ title: "Property Added", description: "Basic profile created. Click the card to add more details." });
      onSuccess();

    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-4">
      <div className="bg-blue-50 p-4 rounded-lg flex gap-3 items-start border border-blue-100">
        <Home className="h-5 w-5 text-blue-600 mt-0.5" />
        <div>
          <h3 className="font-medium text-blue-900">Quick Setup</h3>
          <p className="text-sm text-blue-700">Enter the basics to get started. You can add Mortgage, Tenants, and Tax info later from the dashboard.</p>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label>Property Nickname</Label>
          <Input placeholder="e.g. The Lake House" {...form.register('name')} />
          {form.formState.errors.name && <p className="text-red-500 text-xs">Required</p>}
        </div>

        <div className="grid gap-2">
          <Label>Street Address</Label>
          <Input placeholder="123 Main St" {...form.register('address.street')} />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="grid gap-2"><Label>City</Label><Input {...form.register('address.city')} /></div>
          <div className="grid gap-2"><Label>State</Label><Input {...form.register('address.state')} /></div>
          <div className="grid gap-2"><Label>Zip</Label><Input {...form.register('address.zip')} /></div>
        </div>

        <div className="grid gap-2">
            <Label>Target Rent ($)</Label>
            <div className="relative">
               <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
               <Input className="pl-8" type="number" {...form.register('targetRent')} />
            </div>
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
