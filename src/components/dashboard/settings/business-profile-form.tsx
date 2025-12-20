'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useState, useRef } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useStorage } from '@/firebase/storage/use-storage';
import { ref, getDownloadURL, uploadBytesResumable } from 'firebase/storage';
import { Building2, Upload } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useRouter } from 'next/navigation';

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

export function BusinessProfileForm() {
  const { user } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  
  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userData, isLoading: isLoadingUser } = useDoc<{ businessProfile?: BusinessProfileFormValues }>(userDocRef);

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
      country: 'USA',
      logoUrl: '',
    },
  });

  useEffect(() => {
    if (userData?.businessProfile) {
      const profile = userData.businessProfile;
      form.reset({
        businessName: profile.businessName || '',
        businessType: profile.businessType || '',
        industry: profile.industry || '',
        taxId: profile.taxId || '',
        address: profile.address || '',
        city: profile.city || '',
        state: profile.state || '',
        zip: profile.zip || '',
        country: profile.country || 'USA',
        logoUrl: profile.logoUrl || '',
      });
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
    if (!user || !storage || !event.target.files || event.target.files.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Upload Error',
        description: 'User not authenticated or file not selected.',
      });
      return;
    }
    const file = event.target.files[0];
    
    // Explicitly use the user's UID from the hook at the time of upload.
    const storageRef = ref(storage, `logos/${user.uid}/${file.name}`);
    
    setIsUploading(true);
    setProgress(0);

    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const prog = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setProgress(prog);
      },
      (error) => {
        // This is where storage/unauthorized errors are caught.
        console.error('Firebase Storage Error:', error);
        toast({
          variant: 'destructive',
          title: 'Upload Failed',
          description: error.message || 'Could not upload your logo. Check permissions.',
        });
        setIsUploading(false);
      },
      async () => {
        // Upload completed successfully, now get the download URL.
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          
          // Directly call onSubmit with the new URL, bypassing form-wide validation.
          const currentValues = form.getValues();
          await onSubmit({ ...currentValues, logoUrl: downloadURL });

          toast({
            title: 'Logo Uploaded!',
            description: 'Your new business logo has been saved.',
          });

          // A page refresh is a robust way to ensure the new image is shown,
          // especially after fixing CORS or rule issues.
          router.refresh(); 
        } catch (error: any) {
            console.error('Error getting download URL or saving to Firestore:', error);
            toast({
                variant: 'destructive',
                title: 'Save Failed',
                description: 'Logo uploaded, but failed to save to profile.',
            });
        } finally {
            setIsUploading(false);
        }
      }
    );
  };
  
  if (isLoadingUser) {
      return (
          <Card>
              <CardHeader>
                  <Skeleton className="h-7 w-1/4" />
                  <Skeleton className="h-4 w-2/3" />
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
                 <Skeleton className="h-10 w-full" />
                 <Skeleton className="h-10 w-full" />
                 <div className="grid md:grid-cols-3 gap-6">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
                <div className="flex justify-end">
                    <Skeleton className="h-10 w-24" />
                </div>
              </CardContent>
          </Card>
      )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Business Logo</CardTitle>
            <CardDescription>
              Upload your company logo. This will appear on reports.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-6">
            <Avatar className="h-24 w-24 rounded-lg">
                <AvatarImage src={form.watch('logoUrl')} alt="Business Logo" />
                <AvatarFallback className="rounded-lg">
                    <Building2 className="h-10 w-10 text-muted-foreground" />
                </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                >
                    <Upload className="mr-2 h-4 w-4" />
                    {isUploading ? `Uploading... ${Math.round(progress)}%` : 'Upload Logo'}
                </Button>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleLogoUpload}
                    className="hidden"
                    accept="image/png, image/jpeg, image/gif, image/webp"
                />
                <p className="text-xs text-muted-foreground">
                    Recommended size: 256x256px. PNG, JPG, or GIF.
                </p>
                {isUploading && <Progress value={progress} className="w-full" />}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Business Profile</CardTitle>
            <CardDescription>
              This information will be used for generating reports and other official documents.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              <FormField
                control={form.control}
                name="businessName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Acme Inc." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="businessType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                            <SelectTrigger>
                            <SelectValue placeholder="Select a business type" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value="sole-proprietorship">Sole Proprietorship</SelectItem>
                            <SelectItem value="llc">LLC</SelectItem>
                            <SelectItem value="s-corp">S-Corporation</SelectItem>
                            <SelectItem value="c-corp">C-Corporation</SelectItem>
                            <SelectItem value="non-profit">Non-Profit</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                <FormField
                    control={form.control}
                    name="industry"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Industry</FormLabel>
                        <FormControl>
                        <Input placeholder="e.g., Software, Retail" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="taxId"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Tax ID / EIN</FormLabel>
                        <FormControl>
                        <Input placeholder="XX-XXXXXXX" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </div>
            <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Street Address</FormLabel>
                    <FormControl>
                      <Input placeholder="123 Main St" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                 <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                        <Input placeholder="San Francisco" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>State / Province</FormLabel>
                        <FormControl>
                        <Input placeholder="CA" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="zip"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>ZIP / Postal Code</FormLabel>
                        <FormControl>
                        <Input placeholder="94103" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
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
