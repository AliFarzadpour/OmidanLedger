'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, AlertCircle, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { verifyInviteToken, finalizeInviteAcceptance } from '@/actions/tenant-actions';
import { useAuth } from '@/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';

const signupSchema = z.object({
  password: z.string().min(8, { message: 'Password must be at least 8 characters.' }),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignupFormValues = z.infer<typeof signupSchema>;

export default function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const auth = useAuth();
  
  const [status, setStatus] = useState<'loading' | 'valid' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [inviteData, setInviteData] = useState<{ email: string } | null>(null);

  useEffect(() => {
    const inviteId = searchParams.get('inviteId');
    const token = searchParams.get('token');

    if (!inviteId || !token) {
      setErrorMessage("Missing invitation details in the URL.");
      setStatus('error');
      return;
    }

    const verify = async () => {
      try {
        const result = await verifyInviteToken(inviteId, token);
        if (result.success) {
          setInviteData({ email: result.email });
          setStatus('valid');
        } else {
          throw new Error("Verification failed.");
        }
      } catch (error: any) {
        setErrorMessage(error.message || "Invalid or expired invitation link.");
        setStatus('error');
      }
    };
    verify();
  }, [searchParams]);

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = async (data: SignupFormValues) => {
    const inviteId = searchParams.get('inviteId');
    const token = searchParams.get('token');
    if (!inviteData || !inviteId || !token) return;

    try {
      // 1. Create the user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, inviteData.email, data.password);
      
      if (userCredential.user) {
        await finalizeInviteAcceptance(userCredential.user.uid, inviteId, token);

        toast({
          title: "Account Created!",
          description: "You will now be redirected to your tenant portal.",
        });

        // 2. Redirect to the tenant dashboard
        router.push('/tenant/dashboard');
      } else {
        throw new Error("Could not create user account.");
      }

    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Signup Failed',
        description: error.message || 'An unexpected error occurred.',
      });
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Verifying invitation...</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <Alert variant="destructive" className="max-w-md">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{errorMessage}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="w-full max-w-md shadow-2xl animate-in fade-in-50">
      <CardHeader className="text-center">
        <ShieldCheck className="mx-auto h-12 w-12 text-green-500" />
        <CardTitle className="text-2xl">Create Your Secure Account</CardTitle>
        <CardDescription>
          Set a password to access your tenant portal for <br/>
          <span className="font-bold text-primary">{inviteData?.email}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Account & Sign In
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
