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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useState, useRef } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useStorage } from '@/firebase/storage/use-storage';
import { getAuth } from "firebase/auth"; // Add this import
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
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
  const testFileInputRef = useRef<HTMLInputElement>(null); // New ref for test input
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isTestUploading, setIsTestUploading] = useState(false); // New state for test upload

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
    const auth = getAuth();
    const currentUser = auth.currentUser;
  
    // 1. Critical Check: Is the user actually recognized by Firebase Auth?
    if (!currentUser) {
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: "You must be logged in. Try signing out and back in.",
      });
      return;
    }
  
    const file = event.target.files?.[0];
    if (!file || !userDocRef) return;
  
    // 2. Explicitly use the bucket from your console to avoid any project mismatch
    // This matches your verified bucket: studio-811444605-7ef2a.firebasestorage.app
    const storagePath = `logos/${currentUser.uid}/${file.name}`;
    const storageRef = ref(storage, storagePath);
  
    try {
      console.log("Attempting upload for UID:", currentUser.uid);
      console.log("Target Path:", storagePath);
  
      // 3. Use uploadBytesResumable for better state tracking
      const uploadTask = uploadBytesResumable(storageRef, file);
  
      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setProgress(progress);
          console.log(`Upload is ${progress}% done`);
        }, 
        (error) => {
          // This is where your 'unauthorized' error is caught
          console.error("Upload failed code:", error.code);
          toast({
            variant: "destructive",
            title: "Permission Denied",
            description: `Storage rejected request. UID: ${currentUser.uid.slice(0,5)}...`,
          });
          setIsUploading(false);
        }, 
        async () => {
          // 4. Success handling
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          
          // Update Form state
          form.setValue('logoUrl', downloadURL, { shouldDirty: true });
          
          // Save to Firestore directly (Bypass full form validation)
          await setDoc(userDocRef, { 
            businessProfile: { ...form.getValues(), logoUrl: downloadURL } 
          }, { merge: true });
  
          toast({ title: "Logo Saved", description: "Your profile has been updated." });
          setIsUploading(false);
        }
      );
    } catch (err) {
      console.error("Unexpected Error:", err);
      setIsUploading(false);
    }
  };

  const handleTestUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) {
        console.error("ERROR: No authenticated user found when attempting to upload to Firebase Storage.");
        toast({
            variant: "destructive",
            title: "Authentication Error",
            description: "No authenticated user found. Please log in and try again."
        });
        return;
    }
  
    if (!event.target.files || event.target.files.length === 0) {
        return;
    }
    const file = event.target.files[0];
  
    console.log("User is authenticated:", currentUser.uid);
    const userId = currentUser.uid;
    const testStorageRef = ref(storage, `test-uploads/${userId}/${file.name}`);
    setIsTestUploading(true);

    const uploadTask = uploadBytesResumable(testStorageRef, file);

    uploadTask.on(
        'state_changed',
        () => {}, // No progress tracking needed for this test
        (error) => {
            console.error("Test Upload Error:", error);
            toast({
                variant: 'destructive',
                title: "Test Upload Failed",
                description: error.code,
            });
            setIsTestUploading(false);
        },
        () => {
            toast({
                title: "Test Upload Successful!",
                description: `File '${file.name}' was uploaded.`,
            });
            setIsTestUploading(false);
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
          <CardContent className="space-y-4">
            <div className="flex items-center gap-6">
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
            </div>
            {/* New Test Upload Section */}
            <div className="border-t pt-4">
                <Button
                    type="button"
                    variant="secondary"
                    onClick={() => testFileInputRef.current?.click()}
                    disabled={isTestUploading}
                >
                    {isTestUploading ? "Testing..." : "New Test Upload"}
                </Button>
                <input
                    type="file"
                    ref={testFileInputRef}
                    onChange={handleTestUpload}
                    className="hidden"
                />
                <p className="text-xs text-muted-foreground mt-2">A separate button to test a different upload path.</p>
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
