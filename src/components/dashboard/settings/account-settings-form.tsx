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
import { useUser, useFirestore, useAuth } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { deleteAllUserData } from '@/actions/user-actions';
import { useRouter } from 'next/navigation';

// Same list from signup page for consistency
const TRADE_OPTIONS = [
  "Real Estate Investor / Landlord",
  "Property Manager",
  "General Contractor",
  "Subcontractor (Plumber, Electrician, etc.)",
  "Professional Services (Legal, CPA, Consultant)",
  "Retail / E-commerce",
  "Service Business (Cleaning, Landscaping)",
  "Trucking / Logistics",
  "Other"
];

const accountSettingsSchema = z.object({
  displayName: z.string().optional(),
  trade: z.string().min(1, { message: 'Please select your primary industry.' }),
});

type AccountSettingsFormValues = z.infer<typeof accountSettingsSchema>;

export function AccountSettingsForm() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const form = useForm<AccountSettingsFormValues>({
    resolver: zodResolver(accountSettingsSchema),
    defaultValues: {
      displayName: '',
      trade: '',
    },
  });

  useEffect(() => {
    if (user) {
      // Fetch trade from Firestore user document
      const userDocRef = doc(firestore, 'users', user.uid);
      // This is a one-time fetch, you could use useDoc for realtime updates if needed
      const fetchUserData = async () => {
        const { getDoc } = await import('firebase/firestore');
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
          form.reset({
            displayName: user.displayName || '',
            trade: docSnap.data()?.trade || '',
          });
        } else {
            form.reset({
                displayName: user.displayName || '',
                trade: '',
              });
        }
      };
      fetchUserData();
    }
  }, [user, firestore, form]);

  const onSubmit = async (data: AccountSettingsFormValues) => {
    if (!user || !firestore) return;

    try {
      // Update Firebase Auth display name
      if (user.displayName !== data.displayName) {
        await updateProfile(user, { displayName: data.displayName });
      }

      // Update Firestore user document
      const userDocRef = doc(firestore, 'users', user.uid);
      await updateDoc(userDocRef, {
        trade: data.trade,
        // you can also update the displayName here if you want it in firestore
      });

      toast({
        title: 'Account Updated',
        description: 'Your account settings have been saved.',
      });
    } catch (error: any) {
      console.error('Error updating account:', error);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error.message || 'Could not save your account settings.',
      });
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    try {
      await sendPasswordResetEmail(auth, user.email);
      toast({
        title: 'Password Reset Email Sent',
        description: `Please check your inbox at ${user.email} to reset your password.`,
      });
    } catch (error: any) {
      console.error('Error sending password reset email:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Could not send password reset email.',
      });
    }
  };

  const handleResetAccount = async () => {
    if (!user) return;
    setIsDeleting(true);
    try {
        await deleteAllUserData(user.uid);
        toast({
            title: "Account Data Deleted",
            description: "All your data has been cleared. Please delete your account from the Firebase console now.",
        });
        // Log the user out client-side
        await auth.signOut();
        router.push('/signup'); // Redirect to signup page
    } catch (error: any) {
        toast({
            variant: "destructive",
            title: "Reset Failed",
            description: error.message,
        });
    } finally {
        setIsDeleting(false);
    }
  };
  
  if (isUserLoading) {
      return (
          <Card>
              <CardHeader>
                  <Skeleton className="h-7 w-1/4" />
                  <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent className="space-y-6">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                 <div className="flex justify-end">
                    <Skeleton className="h-10 w-24" />
                </div>
              </CardContent>
          </Card>
      )
  }

  return (
    <>
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Account Settings</CardTitle>
            <CardDescription>
              Manage your personal account details and password.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Jane Doe" {...field} />
                  </FormControl>
                  <FormDescription>This is your public display name.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
                control={form.control}
                name="trade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Industry / Trade</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select your primary business type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TRADE_OPTIONS.map((trade) => (
                          <SelectItem key={trade} value={trade}>
                            {trade}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>This helps us tailor your experience.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            <div className="space-y-2">
                <FormLabel>Password</FormLabel>
                <div className="flex items-center gap-4">
                    <p className="text-sm text-muted-foreground flex-1">For security, we will send a password reset link to your email.</p>
                    <Button type="button" variant="outline" onClick={handlePasswordReset}>Send Reset Email</Button>
                </div>
            </div>
            
          </CardContent>
        </Card>
        <div className="flex justify-end">
            <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Saving...' : 'Save Account Settings'}
            </Button>
        </div>
      </form>
    </Form>

    {/* Danger Zone */}
    <Card className="border-destructive">
        <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>
                These actions are permanent and cannot be undone.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">Reset Account Data</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete ALL your data, including properties,
                    transactions, and settings. Your login will remain, but all
                    associated database records will be erased.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className={buttonVariants({ variant: "destructive" })}
                    onClick={handleResetAccount}
                    disabled={isDeleting}
                  >
                    {isDeleting ? 'Deleting Data...' : 'Yes, Delete Everything'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
        </CardContent>
    </Card>
    </>
  );
}
