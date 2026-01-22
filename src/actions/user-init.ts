'use server';

import { getAdminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { sendWelcomeEmail } from './email-actions';

const db = getAdminDb();

export async function initializeUserSchema(userId: string, email: string, provider: string, trade?: string) {
  const userRef = db.collection('users').doc(userId);

  const doc = await userRef.get();

  // Define default billing/role settings
  const defaultSchema: {[key:string]: any} = {
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

  if (trade) {
    defaultSchema.trade = trade;
  }

  if (!doc.exists) {
    // New User: Set full schema
    await userRef.set(defaultSchema);
    // Send welcome email to new user
    await sendWelcomeEmail({ email, name: email.split('@')[0] });
  } else {
    // Existing User: Only add missing fields (Migration)
    const updateData: {[key: string]: any} = {
      'metadata.lastLogin': FieldValue.serverTimestamp(),
      authProvider: provider, // Track how they logged in
      // Ensure role exists if it was missing
      role: doc.data()?.role || 'landlord'
    };
    if (trade) {
      updateData.trade = trade;
    }
    await userRef.update(updateData);
  }
}
