'use client';

import React from 'react';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from '@/components/ui/toaster';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <HelmetProvider>
      <FirebaseClientProvider>
        {children}
      </FirebaseClientProvider>
      <Toaster />
    </HelmetProvider>
  );
}
