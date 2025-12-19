'use server';

import { getAdminDB } from '@/lib/admin-db';
import { FieldValue } from 'firebase-admin/firestore';

export async function initializeUserSchema(userId: string, email: string, provider: string) {
  const db = getAdminDB();
  const userRef = db.collection('users').doc(userId);

  const doc = await userRef.get();

  // Define default billing/role settings
  const defaultSchema = {
    email: email,
    role: 'landlord', // Default new signups to landlord
    authProvider: provider,
    billing: {
      subscriptionTier: 'free',
      status: 'trialing',
      baseFee: 0,
      propertyRate: 0,
      transactionFeePercent: 0
    },
    metadata: {
      createdAt: FieldValue.serverTimestamp(),
      lastLogin: FieldValue.serverTimestamp(),
      propertyCount: 0
    }
  };

  if (!doc.exists) {
    // New User: Set full schema
    await userRef.set(defaultSchema);
  } else {
    // Existing User: Only add missing fields (Migration)
    await userRef.update({
      'metadata.lastLogin': FieldValue.serverTimestamp(),
      authProvider: provider, // Track how they logged in
      // Ensure role exists if it was missing
      role: doc.data()?.role || 'landlord'
    });
  }
}
