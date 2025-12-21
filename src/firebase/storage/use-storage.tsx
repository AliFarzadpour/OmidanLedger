'use client';

import { useFirebase } from '@/firebase/provider';
import { FirebaseStorage } from 'firebase/storage';

/**
 * Hook specifically for accessing the Firebase Storage service instance.
 * @returns {FirebaseStorage} The Firebase Storage instance.
 */
export const useStorage = (): FirebaseStorage => {
  const { storage } = useFirebase();
  return storage;
};
