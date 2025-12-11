'use client';
import {
  Auth, // Import Auth type for type hinting
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  AuthError,
  // Assume getAuth and app are initialized elsewhere
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';
import { initializeFirebase } from './index';

/** Initiate anonymous sign-in (non-blocking). */
export function initiateAnonymousSignIn(authInstance: Auth, onError?: (error: AuthError) => void): void {
  // CRITICAL: Call signInAnonymously directly. Do NOT use 'await signInAnonymously(...)'.
  signInAnonymously(authInstance).catch(onError);
  // Code continues immediately. Auth state change is handled by onAuthStateChanged listener.
}

/** Initiate email/password sign-up (non-blocking). */
export function initiateEmailSignUp(authInstance: Auth, email: string, password: string, onError?: (error: AuthError) => void): void {
  createUserWithEmailAndPassword(authInstance, email, password)
    .then(userCredential => {
      // User is created in Auth, now create their document in Firestore.
      const { firestore } = initializeFirebase();
      const userDocRef = doc(firestore, 'users', userCredential.user.uid);
      
      // We don't await this, to keep the UI non-blocking.
      // This creates the user profile document.
      setDoc(userDocRef, {
        id: userCredential.user.uid,
        email: userCredential.user.email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    })
    .catch(onError);
}


/** Initiate email/password sign-in (non-blocking). */
export function initiateEmailSignIn(authInstance: Auth, email: string, password: string, onError?: (error: AuthError) => void): void {
  // CRITICAL: Call signInWithEmailAndPassword directly. Do NOT use 'await signInWithEmailAndPassword(...)'.
  signInWithEmailAndPassword(authInstance, email, password).catch(onError);
  // Code continues immediately. Auth state change is handled by onAuthStateChanged listener.
}
