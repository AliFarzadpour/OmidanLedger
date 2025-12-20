'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Form,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser, useFirestore, useAuth } from '@/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { deleteAllUserData } from '@/actions/user-actions';
import { useRouter } from 'next/navigation';
import { FormLabel } from '@/components/ui/label';

const accountSettingsSchema = z.object({});

type AccountSettingsFormValues = z.infer<typeof accountSettingsSchema>;

export function AccountSettingsForm() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const form = useForm<AccountSettingsFormValues>({
    resolver: zodResolver(accountSettingsSchema),
    defaultValues: {},
  });


  const onSubmit = async (data: AccountSettingsFormValues) => {
    // This function is now empty as there are no fields to submit,
    // but we keep it for form structure.
    toast({
        title: 'No changes to save',
        description: 'This section is for managing your password and account data.',
      });
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
              Manage your personal account details and password functionality.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="space-y-2">
                <FormLabel>Password Reset</FormLabel>
                <div className="flex items-center gap-4">
                    <p className="text-sm text-muted-foreground flex-1">For security, we will send a password reset link to your email.</p>
                    <Button type="button" variant="outline" onClick={handlePasswordReset}>Send Reset Email</Button>
                </div>
            </div>
            
          </CardContent>
        </Card>
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
