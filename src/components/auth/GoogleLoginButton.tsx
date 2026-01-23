'use client';

import { useState } from 'react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { useAuth, useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { Loader2 } from 'lucide-react';
import { initializeUserSchema } from '@/actions/user-init';

export function GoogleLoginButton() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // CRITICAL: Check if user document already exists to prevent overwrite
      const userDocRef = doc(firestore, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        // User is new, create their document using the existing server action
        await initializeUserSchema(user.uid, user.email!, 'google.com');
        toast({
          title: 'Welcome!',
          description: 'Your account has been created successfully.',
        });
      }
      // If userDoc.exists(), we do nothing. The user will be redirected by the
      // useUser hook in the login page's layout.

    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Sign-in Failed',
        description: error.message || 'An unexpected error occurred during Google sign-in.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      className="w-full"
      onClick={handleGoogleSignIn}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Image
            src="https://firebasestorage.googleapis.com/v0/b/studio-7576922301-bac28.firebasestorage.app/o/logos%2FGoogle%20Logo.png?alt=media&token=8431062c-df3b-47c1-990c-444f603c4062"
            alt="Google icon"
            width={16}
            height={16}
            className="mr-2"
        />
      )}
      Sign in with Google
    </Button>
  );
}
