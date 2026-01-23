'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/logo';
import { useAuth, useUser } from '@/firebase';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Lock, Banknote, Loader2, FileText } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { signInWithEmailAndPassword, type Auth, type AuthError } from 'firebase/auth';
import { Helmet } from 'react-helmet-async';
import { GoogleLoginButton } from '@/components/auth/GoogleLoginButton';

/** Initiate email/password sign-in (non-blocking). */
export function initiateEmailSignIn(authInstance: Auth, email: string, password: string, onError?: (error: AuthError) => void): void {
  // CRITICAL: Call signInWithEmailAndPassword directly. Do NOT use 'await signInWithEmailAndPassword(...)'.
  signInWithEmailAndPassword(authInstance, email, password).catch(onError);
  // Code continues immediately. Auth state change is handled by onAuthStateChanged listener.
}


const loginSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const [authError, setAuthError] = useState<string | null>(null);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  useEffect(() => {
    if (!isUserLoading && user) {
      router.push('/dashboard');
    }
  }, [user, isUserLoading, router]);

  const onSubmit = async (data: LoginFormValues) => {
    setAuthError(null);
    initiateEmailSignIn(auth, data.email, data.password, (error) => {
      let errorMessage = 'An unexpected error occurred. Please try again.';
      if (error?.code === 'auth/invalid-credential' || error?.code === 'auth/user-not-found' || error?.code === 'auth/wrong-password') {
        errorMessage = 'Invalid email or password. Please check your credentials and try again.';
      } else if (error?.message) {
        errorMessage = error.message;
      }
      setAuthError(errorMessage);
    });
  };

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "OmidanLedger",
    "applicationCategory": "FinanceApplication",
    "operatingSystem": "Web",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD",
      "description": "Free beta testing phase"
    },
    "description": "A modern financial management platform for real estate investors and landlords.",
    "featureList": "Automated Bookkeeping, AI-Powered Categorization, Real-time Reporting"
  };
  
  if (isUserLoading || user) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen grid lg:grid-cols-2">
      <Helmet>
        {/* 1. Basic Meta Tags */}
        <title>OmidanLedger | Free Landlord Rent Tracking & Financial Software</title>
        <meta 
          name="description" 
          content="Simplify your property management. Track rent, manage expenses, and generate real-time financial reports in one secure dashboard. Free for landlords." 
        />
        
        {/* 2. Open Graph (for nicer links on LinkedIn/Facebook) */}
        <meta property="og:title" content="OmidanLedger - All-in-One Financial Command Center" />
        <meta property="og:description" content="Automated bookkeeping and expense tracking for real estate investors." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://omidanledger.net/" />
        
        {/* 3. The 'Invisible' Schema Code for AI Bots */}
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>
      <div className="hidden lg:flex flex-col items-start justify-center bg-slate-50 p-12 text-slate-800">
        <div className="mb-8">
            <Logo />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Your All-in-One Financial Command Center</h1>
        <p className="mt-4 text-slate-600 leading-relaxed">
          OmidanLedger is a modern financial management platform designed for real estate investors and property managers. Our goal is to simplify your bookkeeping, automate expense tracking, and provide you with clear, actionable financial insights.
        </p>

        <div className="mt-8 space-y-4 text-slate-600">
            <div className="flex gap-4">
                <Banknote className="h-6 w-6 text-primary shrink-0 mt-1"/>
                <div>
                    <h3 className="font-semibold">Automated Bookkeeping</h3>
                    <p className="text-sm">Connect bank accounts via Plaid for secure, automatic transaction syncing and categorization.</p>
                </div>
            </div>
             <div className="flex gap-4">
                <Lock className="h-6 w-6 text-primary shrink-0 mt-1"/>
                <div>
                    <h3 className="font-semibold">AI-Powered Categorization</h3>
                    <p className="text-sm">Our AI engine learns your spending habits and automatically suggests categories for your review.</p>
                </div>
            </div>
             <div className="flex gap-4">
                <FileText className="h-6 w-6 text-primary shrink-0 mt-1"/>
                <div>
                    <h3 className="font-semibold">Real-time Reporting</h3>
                    <p className="text-sm">Generate Profit & Loss statements, rent rolls, and other crucial reports with a single click.</p>
                </div>
            </div>
        </div>

        <div className="mt-10 border-t border-slate-200 pt-6 text-sm text-slate-500">
            <p><span className="font-semibold">No Obligation:</span> This application is currently in a beta testing phase and is free to use. There is no commitment required.</p>
        </div>
      </div>

      <div className="flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md shadow-2xl">
            <CardHeader className="space-y-1 text-center pt-8">
              <div className="flex justify-center mb-4 lg:hidden">
                <Logo />
              </div>
              <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
              <CardDescription>Sign in to manage your portfolio.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
                  {authError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Login Failed</AlertTitle>
                      <AlertDescription>{authError}</AlertDescription>
                    </Alert>
                  )}
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="landlord@email.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center">
                          <FormLabel>Password</FormLabel>
                          <Link href="#" className="ml-auto inline-block text-sm underline text-muted-foreground hover:text-primary">
                            Forgot your password?
                          </Link>
                        </div>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing In...
                      </>
                    ) : 'Sign In'}
                  </Button>
                </form>
              </Form>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                    Or continue with
                    </span>
                </div>
              </div>
              <GoogleLoginButton />
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <div className="text-center text-sm">
                New here?{' '}
                <Link href="/signup" className="underline">
                  Create a free account
                </Link>
              </div>
              <div className="text-center text-xs">
                <Link
                  href="https://omidanledger.com/privacy"
                  className="underline text-muted-foreground hover:text-primary"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Privacy Policy
                </Link>
              </div>
            </CardFooter>
          </Card>
      </div>
    </div>
  );
}
