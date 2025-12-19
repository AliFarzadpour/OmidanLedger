'use client';
import {
  Auth, // Import Auth type for type hinting
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  AuthError,
  // Assume getAuth and app are initialized elsewhere
} from 'firebase/auth';
import { initializeUserSchema } from '@/actions/user-init';

/** Initiate anonymous sign-in (non-blocking). */
export function initiateAnonymousSignIn(authInstance: Auth, onError?: (error: AuthError) => void): void {
  // CRITICAL: Call signInAnonymously directly. Do NOT use 'await signInAnonymously(...)'.
  signInAnonymously(authInstance).catch(onError);
  // Code continues immediately. Auth state change is handled by onAuthStateChanged listener.
}

/** Initiate email/password sign-up (non-blocking). */
export function initiateEmailSignUp(authInstance: Auth, email: string, password: string, trade: string, onError?: (error: AuthError) => void): void {
  createUserWithEmailAndPassword(authInstance, email, password)
    .then(async (userCredential) => {
      // User is created in Auth, now create their full schema in Firestore.
      // This is a server action that sets the role, billing, etc.
      await initializeUserSchema(userCredential.user.uid, email, 'password');

      // We can also update the 'trade' separately if it's collected at signup.
      // This is a client-side update to the new user document.
      const { getFirestore, doc, updateDoc } = await import('firebase/firestore');
      const { firestore } = initializeFirebase();
      const userDocRef = doc(firestore, 'users', userCredential.user.uid);
      await updateDoc(userDocRef, { trade });
    })
    .catch(onError);
}


/** Initiate email/password sign-in (non-blocking). */
export function initiateEmailSignIn(authInstance: Auth, email: string, password: string, onError?: (error: AuthError) => void): void {
  // CRITICAL: Call signInWithEmailAndPassword directly. Do NOT use 'await signInWithEmailAndPassword(...)'.
  signInWithEmailAndPassword(authInstance, email, password).catch(onError);
  // Code continues immediately. Auth state change is handled by onAuthStateChanged listener.
}
