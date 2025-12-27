
'use server';

import { db } from '@/lib/admin-db';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

interface CreateAccountLinkArgs {
  userId: string;
  userEmail: string;
  returnUrl: string;
  refreshUrl: string;
}

/**
 * Creates a Stripe Express account for a user if they don't have one,
 * and then generates a one-time link for them to complete the onboarding process.
 */
export async function createStripeAccountLink({
  userId,
  userEmail,
  returnUrl,
  refreshUrl,
}: CreateAccountLinkArgs) {
  try {
    const userDocRef = db.collection('users').doc(userId);
    const userDoc = await userDocRef.get();
    
    if (!userDoc.exists) {
      throw new Error('User not found.');
    }
    
    let stripeAccountId = userDoc.data()?.stripeAccountId;

    // 1. Create a Stripe Express account if the user doesn't have one yet
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

      // Save the new Stripe Account ID to the user's document in Firestore
      await userDocRef.update({ stripeAccountId: stripeAccountId });
    }

    // 2. Create the Account Link for onboarding
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
