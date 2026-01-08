'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, writeBatch, collection, getDocs, query, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Banknote, Loader2, Save } from 'lucide-react';

function ClientOnly({ children }: { children: React.ReactNode }) {
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return null;
  }
  return <>{children}</>;
}


const paymentSettingsSchema = z.object({
  enableStripe: z.boolean().default(false),
  enableZelle: z.boolean().default(true),
  zelleRecipientName: z.string().optional(),
  zelleRecipientHandle: z.string().optional(),
  zelleMemoTemplate: z.string().optional(),
  zelleNotes: z.string().optional(),
});

type PaymentSettingsFormValues = z.infer<typeof paymentSettingsSchema>;

export function PaymentSettingsForm() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid, 'settings', 'payments');
  }, [firestore, user]);

  const { data: userData, isLoading: isLoadingUser } = useDoc<{ 
    stripeEnabled: boolean;
    zelleEnabled: boolean;
    zelleRecipientName?: string;
    zelleRecipientHandle?: string;
    zelleMemoTemplate?: string;
    zelleNotes?: string;
    stripeStatus?: string;
  }>(userDocRef);

  const form = useForm<PaymentSettingsFormValues>({
    resolver: zodResolver(paymentSettingsSchema),
    defaultValues: {
      enableStripe: false,
      enableZelle: true,
      zelleRecipientName: '',
      zelleRecipientHandle: '',
      zelleMemoTemplate: '{{propertyName}} {{month}} Rent',
      zelleNotes: '',
    },
  });

  useEffect(() => {
    if (userData) {
      form.reset({
        enableStripe: userData.stripeEnabled,
        enableZelle: userData.zelleEnabled,
        zelleRecipientName: userData.zelleRecipientName,
        zelleRecipientHandle: userData.zelleRecipientHandle,
        zelleMemoTemplate: userData.zelleMemoTemplate,
        zelleNotes: userData.zelleNotes,
      });
    }
  }, [userData, form]);

  const onSubmit = async (data: PaymentSettingsFormValues) => {
    if (!userDocRef) return;
    try {
      await setDoc(userDocRef, data, { merge: true });
      toast({
        title: 'Payment Settings Saved',
        description: 'Your default payment preferences have been updated.',
      });
    } catch (error) {
      console.error('Error updating payment settings:', error);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: 'Could not save your payment settings.',
      });
    }
  };

  const handleApplyToAll = async () => {
    if (!user || !firestore) return;

    const currentSettings = form.getValues();

    try {
      const q = query(collection(firestore, 'properties'), where('userId', '==', user.uid));
      const propertiesSnap = await getDocs(q);
      
      const batch = writeBatch(firestore);
      propertiesSnap.forEach(propDoc => {
        const propRef = doc(firestore, 'properties', propDoc.id);
        const settingsToApply = {
          methods: {
            stripe: { enabled: currentSettings.enableStripe },
            zelle: { 
              enabled: currentSettings.enableZelle,
              recipientName: currentSettings.zelleRecipientName,
              recipientContact: currentSettings.zelleRecipientHandle,
              memoTemplate: currentSettings.zelleMemoTemplate,
              notes: currentSettings.zelleNotes
            }
          },
          updatedAt: new Date().toISOString()
        };
        batch.set(propRef, { paymentSettings: settingsToApply }, { merge: true });
      });

      await batch.commit();

      toast({
        title: 'Defaults Applied',
        description: `Your default payment settings have been applied to ${propertiesSnap.size} properties.`
      });

    } catch (error) {
      console.error("Failed to apply defaults:", error);
       toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: 'Could not apply settings to all properties.',
      });
    }
  };
  
  if (isLoadingUser) {
      return (
          <Card>
              <CardHeader><Skeleton className="h-7 w-1/4" /></CardHeader>
              <CardContent><Skeleton className="h-40 w-full" /></CardContent>
          </Card>
      )
  }

  return (
    <ClientOnly>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Payment Methods</CardTitle>
              <CardDescription>
                Set the default payment options you offer to your tenants. These can be overridden per property.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              
              <FormField
                control={form.control}
                name="enableStripe"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Enable Stripe Payments</FormLabel>
                      <FormDescription>Allow tenants to pay via credit card or ACH through Stripe (fees apply).</FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={userData?.stripeStatus !== 'active'}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="enableZelle"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Enable Zelle / Manual Payments</FormLabel>
                      <FormDescription>Provide instructions for tenants to pay manually via Zelle, check, or cash.</FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              {form.watch('enableZelle') && (
                <div className="space-y-4 pt-4 border-t animate-in fade-in-50">
                    <h4 className="font-semibold">Default Zelle Instructions</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="zelleRecipientName" render={({ field }) => (
                          <FormItem><FormLabel>Recipient Name</FormLabel><FormControl><Input placeholder="e.g., Jane Doe or Acme LLC" {...field} /></FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name="zelleRecipientHandle" render={({ field }) => (
                          <FormItem><FormLabel>Recipient Phone or Email</FormLabel><FormControl><Input placeholder="e.g., landlord@email.com" {...field} /></FormControl></FormItem>
                      )} />
                    </div>
                    <FormField control={form.control} name="zelleMemoTemplate" render={({ field }) => (
                        <FormItem><FormLabel>Memo Template</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                    )} />
                     <FormField control={form.control} name="zelleNotes" render={({ field }) => (
                        <FormItem><FormLabel>Additional Notes</FormLabel><FormControl><Textarea placeholder="Optional notes for tenants..." {...field} /></FormControl></FormItem>
                    )} />
                </div>
              )}
              
            </CardContent>
            <CardFooter className="flex justify-between border-t p-6">
              <AlertDialog>
                  <AlertDialogTrigger asChild>
                      <Button type="button" variant="outline">Apply to All Properties</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                      <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                          This will overwrite the payment settings on all of your existing properties with these defaults. This action cannot be undone.
                      </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleApplyToAll}>Continue</AlertDialogAction>
                      </AlertDialogFooter>
                  </AlertDialogContent>
              </AlertDialog>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                Save Defaults
              </Button>
            </CardFooter>
          </Card>
        </form>
      </Form>
    </ClientOnly>
  );
}
