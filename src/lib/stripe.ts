import Stripe from 'stripe';

// Use a dummy key for the build process if the real one is missing.
// The real key will be loaded safely when the app actually runs.
const stripeKey = process.env.STRIPE_SECRET_KEY || 'dummy_key_for_build';

export const stripe = new Stripe(stripeKey, {
  apiVersion: '2023-10-16', // Using a standard stable version
  typescript: true,
});
