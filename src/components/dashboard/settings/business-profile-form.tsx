
'use client';

import { useForm } from 'react-hook-form';
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
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useState, useRef } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useStorage } from '@/firebase/storage/use-storage';
import { getAuth } from "firebase/auth";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { Building2, Upload, Loader2, Link as LinkIcon, CheckCircle2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { createStripeAccountLink } from '@/actions/stripe-connect-actions';

const businessProfileSchema = z.object({
  businessName: z.string().optional(),
  businessType: z.string().optional(),
  industry: z.string().optional(),
  taxId: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  country: z.string().optional(),
  logoUrl: z.string().optional(),
});

type BusinessProfileFormValues = z.infer<typeof businessProfileSchema>;

const BUSINESS_OPTIONS = [
  { value: "sole-proprietorship", label: "Sole Proprietorship" },
  { value: "llc", label: "LLC" },
  { value: "s-corp", label: "S-Corporation" },
  { value: "c-corp", label: "C-Corporation" },
  { value: "non-profit", label: "Non-Profit" },
  { value: "other", label: "Other" },
];

export function BusinessProfileForm() {
  const { user } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isConnectingStripe, setIsConnectingStripe] = useState(false);

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userData, isLoading: isLoadingUser } = useDoc<{ businessProfile?: BusinessProfileFormValues, stripeAccountId?: string, billing?: { stripeStatus?: string } }>(userDocRef);

  const form = useForm<BusinessProfileFormValues>({
    resolver: zodResolver(businessProfileSchema),
    defaultValues: {
      businessName: '',
      businessType: '',
      industry: '',
      taxId: '',
      address: '',
      city: '',
      state: '',
      zip: '',
      country: '',
      logoUrl: '',
    },
  });

  useEffect(() => {
    if (userData?.businessProfile) {
      form.reset(userData.businessProfile);
    }
  }, [userData, form]);

  const onSubmit = async (data: BusinessProfileFormValues) => {
    if (!userDocRef) return;

    try {
      const sanitizedData = Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, v === undefined ? "" : v])
      );
      await setDoc(userDocRef, { businessProfile: sanitizedData }, { merge: true });
      
      toast({
        title: 'Profile Updated',
        description: 'Your business information has been saved.',
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: 'Could not save your business information.',
      });
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user || !storage || !userDocRef) return;

    const storagePath = `logos/${user.uid}/${file.name}`;
    const storageRef = ref(storage, storagePath);

    setIsUploading(true);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed',
      (snapshot) => setProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
      (error) => {
        toast({ variant: "destructive", title: "Upload Failed", description: error.message });
        setIsUploading(false);
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        form.setValue('logoUrl', downloadURL, { shouldDirty: true });
        await setDoc(userDocRef, { businessProfile: { ...form.getValues(), logoUrl: downloadURL } }, { merge: true });
        toast({ title: "Logo Saved", description: "Your profile has been updated." });
        setIsUploading(false);
      }
    );
  };
  
  const handleStripeConnect = async () => {
    if (!user?.email) return;
    setIsConnectingStripe(true);
    try {
        const { origin } = window.location;
        const result = await createStripeAccountLink({
            userId: user.uid,
            userEmail: user.email,
            returnUrl: `${origin}/dashboard/stripe/return`,
            refreshUrl: `${origin}/dashboard/settings`,
        });

        if (result.success && result.url) {
            // FIX: Use window.top.location.href to break out of the iframe
            if (window.top) {
                window.top.location.href = result.url;
            } else {
                window.location.href = result.url;
            }
        } else {
            throw new Error("Failed to get Stripe redirect URL.");
        }
    } catch (error: any) {
        toast({ variant: "destructive", title: "Stripe Connection Failed", description: error.message });
        setIsConnectingStripe(false);
    }
  };

  if (isLoadingUser) {
    return <Card><CardHeader><Skeleton className="h-7 w-1/4" /></CardHeader><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>;
  }
  
  const logoUrl = form.watch('logoUrl');
  const stripeStatus = userData?.billing?.stripeStatus;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        
        <Card>
          <CardHeader>
            <CardTitle>Payout Account</CardTitle>
            <CardDescription>
              Connect your bank account via Stripe to receive rent payments. Stripe handles all financial data securely.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stripeStatus === 'active' ? (
                 <div className="flex items-center gap-3 bg-green-50 text-green-800 p-4 rounded-md border border-green-200 text-sm font-medium">
                    <CheckCircle2 className="h-5 w-5" />
                    Your account is connected and ready to receive payments.
                </div>
            ) : (
                <Button type="button" onClick={handleStripeConnect} disabled={isConnectingStripe}>
                    {isConnectingStripe ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LinkIcon className="mr-2 h-4 w-4" />}
                    {stripeStatus === 'incomplete' ? 'Re-connect with Stripe' : 'Connect with Stripe'}
                </Button>
            )}
             {stripeStatus === 'incomplete' && <p className="text-sm text-destructive mt-2">Your Stripe account setup is incomplete. Please re-connect to finish.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Business Logo</CardTitle>
            <CardDescription>Upload your company logo to be used on reports.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 rounded-lg border bg-muted/50 flex items-center justify-center overflow-hidden">
                {logoUrl ? <Image src={logoUrl} alt="Logo" width={96} height={96} className="object-contain" /> : <Building2 className="h-10 w-10 text-muted-foreground" />}
              </div>
              <div className="flex-1 space-y-2">
                  <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                      <Upload className="mr-2 h-4 w-4" />
                      {isUploading ? `Uploading... ${Math.round(progress)}%` : 'Upload Logo'}
                  </Button>
                  <input type="file" ref={fileInputRef} onChange={handleLogoUpload} className="hidden" accept="image/png, image/jpeg, image/gif, image/webp" />
                  <p className="text-xs text-muted-foreground">PNG, JPG, or GIF up to 5MB.</p>
                  {isUploading && <Progress value={progress} className="w-full" />}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Business Profile</CardTitle>
            <CardDescription>This information will be used for generating reports.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              <FormField control={form.control} name="businessName" render={({ field }) => (
                <FormItem><FormLabel>Business Name</FormLabel><FormControl><Input placeholder="e.g., Acme Inc." {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="businessType" render={({ field }) => (
                <FormItem><FormLabel>Business Type</FormLabel><RadioGroup onValueChange={field.onChange} value={field.value} className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2">
                  {BUSINESS_OPTIONS.map(o => <FormItem key={o.value} className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value={o.value} /></FormControl><FormLabel className="font-normal">{o.label}</FormLabel></FormItem>)}
                </RadioGroup><FormMessage /></FormItem>
              )} />
            </div>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                <FormField control={form.control} name="industry" render={({ field }) => (
                  <FormItem><FormLabel>Industry</FormLabel><FormControl><Input placeholder="e.g., Real Estate" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="taxId" render={({ field }) => (
                  <FormItem><FormLabel>Tax ID / EIN</FormLabel><FormControl><Input placeholder="XX-XXXXXXX" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
            </div>
            <FormField control={form.control} name="address" render={({ field }) => (
              <FormItem><FormLabel>Street Address</FormLabel><FormControl><Input placeholder="123 Main St" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                 <FormField control={form.control} name="city" render={({ field }) => (
                  <FormItem><FormLabel>City</FormLabel><FormControl><Input placeholder="San Francisco" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="state" render={({ field }) => (
                  <FormItem><FormLabel>State / Province</FormLabel><FormControl><Input placeholder="CA" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="zip" render={({ field }) => (
                  <FormItem><FormLabel>ZIP / Postal Code</FormLabel><FormControl><Input placeholder="94103" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}
