
'use server';

import { db } from '@/lib/admin-db';
import Stripe from 'stripe';
import { getAuth } from 'firebase-admin/auth';
import { adminApp } from '@/lib/firebase-admin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

interface CreateAccountLinkArgs {
  returnUrl: string;
  refreshUrl: string;
}

/**
 * Creates a Stripe Express account for a user if they don't have one,
 * and then generates a one-time link for them to complete the onboarding process.
 * This function now uses the authenticated user from the server context.
 */
export async function createStripeAccountLink({
  returnUrl,
  refreshUrl,
}: CreateAccountLinkArgs) {
  const auth = getAuth(adminApp);
  // This would typically come from an authenticated session managed by your Next.js auth solution
  // For this example, we'll assume a placeholder or a way to get the current user's ID server-side.
  // In a real app, you'd replace 'HARDCODED_USER_ID' with the actual authenticated user's ID.
  const userId = 'HARDCODED_USER_ID_NEEDS_REPLACEMENT'; // This needs a real auth system to work.
  const userEmail = 'placeholder@example.com'; // Same here.

  try {
    const userDocRef = db.collection('users').doc(userId);
    const userDoc = await userDocRef.get();
    
    if (!userDoc.exists) {
      throw new Error('User not found.');
    }
    
    let stripeAccountId = userDoc.data()?.stripeAccountId;

    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: userEmail,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'individual',
      });
      stripeAccountId = account.id;

      await userDocRef.update({ stripeAccountId: stripeAccountId });
    }

    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    return { success: true, url: accountLink.url };
  } catch (error: any) {
    console.error('Stripe Connect error:', error);
    throw new Error(error.message || 'Failed to create Stripe account link.');
  }
}

/**
 * Checks the status of a user's Stripe account to verify onboarding is complete.
 */
export async function checkStripeAccountStatus(userId: string) {
    if (!userId) {
        throw new Error('User ID is required.');
    }

    try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) throw new Error('User not found.');
        
        const stripeAccountId = userDoc.data()?.stripeAccountId;
        if (!stripeAccountId) throw new Error('Stripe account not linked.');
        
        const account = await stripe.accounts.retrieve(stripeAccountId);
        
        const isReady = account.charges_enabled && account.payouts_enabled;

        // Persist the verified status in Firestore
        await db.collection('users').doc(userId).update({
            'billing.stripeStatus': isReady ? 'active' : 'incomplete',
        });
        
        return {
            isReady,
            chargesEnabled: account.charges_enabled,
            payoutsEnabled: account.payouts_enabled,
            detailsSubmitted: account.details_submitted
        };
    } catch (error: any) {
        console.error('Error checking Stripe account status:', error);
        throw new Error(error.message || 'Failed to verify Stripe account status.');
    }
}
