
'use server';

import { db } from '@/lib/firebaseAdmin';
import Stripe from 'stripe';

const stripeKey = process.env.STRIPE_SECRET_KEY || 'dummy_key_for_build';
const stripe = new Stripe(stripeKey, {
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
  if (!userId || !userEmail) {
    throw new Error('User ID and email are required.');
  }

  try {
    const userDocRef = db.collection('users').doc(userId);
    const userDoc = await userDocRef.get();
    
    if (!userDoc.exists) {
      throw new Error('User not found.');
    }
    
    const userData = userDoc.data();
    let stripeAccountId = userData?.stripeAccountId;

    // If the user doesn't have a Stripe account ID yet, create one.
    if (!stripeAccountId) {
      // Get the business name from the user's profile to pass to Stripe.
      const businessName = userData?.businessProfile?.businessName;

      const account = await stripe.accounts.create({
        type: 'express',
        email: userEmail,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'individual',
        // Set the business profile name on the Stripe account
        ...(businessName && { business_profile: { name: businessName } }),
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
    const userDoc = await db.collection('users').doc(userId).get();
    const data = userDoc.data();
    
    // MATCH YOUR DATABASE: stripeAccountId is a root field
    const stripeAccountId = data?.stripeAccountId; 

    if (!stripeAccountId) {
        throw new Error("No Stripe Account ID found in your profile.");
    }

    const account = await stripe.accounts.retrieve(stripeAccountId);
    const isReady = account.details_submitted && account.charges_enabled && account.payouts_enabled;

    if (isReady) {
        // This update will trigger your frontend to show 'Success'
        await db.collection('users').doc(userId).update({
            'billing.stripeStatus': 'active' 
        });
    }

    return { 
        isReady,
        detailsSubmitted: account.details_submitted,
        payoutsEnabled: account.payouts_enabled,
        chargesEnabled: account.charges_enabled
    };
}
