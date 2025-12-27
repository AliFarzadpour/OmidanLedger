
import { NextResponse } from 'next/server';
import { db } from '@/lib/admin-db';
import { FieldValue } from 'firebase-admin/firestore';
import { incrementPropertyStats } from '@/actions/update-property-stats';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

// This is your new webhook handler
export async function POST(req: Request) {
  const payload = await req.text();
  const sig = req.headers.get('stripe-signature');
  const webhookSecrets = process.env.STRIPE_WEBHOOK_SECRET?.split(',') || [];

  let event: Stripe.Event;

  try {
    if (!sig || webhookSecrets.length === 0) {
      throw new Error('Stripe signature or webhook secret is missing.');
    }
    
    // Iterate through secrets to find the correct one
    let verified = false;
    for (const secret of webhookSecrets) {
      try {
        event = stripe.webhooks.constructEvent(payload, sig, secret.trim());
        verified = true;
        break; // Found the correct secret
      } catch (err) {
        // Ignore 'No matching signature' errors and try the next secret
        if ((err as Stripe.StripeSignatureVerificationError).type !== 'StripeSignatureVerificationError') {
          throw err; // Re-throw other errors
        }
      }
    }

    if (!verified) {
      throw new Error('Webhook signature verification failed. No matching secret found.');
    }

    // The webhook listens for the 'invoice.paid' event from Stripe
    if (event.type === 'invoice.paid') {
      const invoice = event.data.object as Stripe.Invoice;
      
      // Handle the invoice.paid event
      // Find the tenant in your database using the email from the Stripe invoice
      const tenantQuery = await db.collection('users').where('email', '==', invoice.customer_email).limit(1).get();
      if (tenantQuery.empty) {
        console.warn(`Webhook Error: Tenant not found for email: ${invoice.customer_email}`);
        return NextResponse.json({ received: true, message: 'Tenant not found.' });
      }

      const tenantDoc = tenantQuery.docs[0];
      const tenantData = tenantDoc.data();
      const { landlordId, associatedPropertyId, id: tenantId } = tenantData;

      if (!landlordId || !associatedPropertyId) {
        throw new Error(`Tenant ${tenantId} is missing landlord or property association.`);
      }

      // Find a destination bank account for the landlord to record the income.
      const landlordAccountsSnap = await db.collection('users').doc(landlordId)
        .collection('bankAccounts').where('accountType', '==', 'checking').limit(1).get();
        
      let destinationAccountId = 'stripe-income'; // Fallback virtual account
      if (!landlordAccountsSnap.empty) {
          destinationAccountId = landlordAccountsSnap.docs[0].id;
      }

      // Create the Transaction record for the Landlord for bookkeeping
      const txRef = db.collection('users').doc(landlordId)
        .collection('bankAccounts').doc(destinationAccountId)
        .collection('transactions').doc(); // Auto-generate a new transaction ID

      const amountPaid = invoice.amount_paid / 100; // Convert from cents to dollars

      await txRef.set({
        amount: amountPaid,
        description: `Invoice payment from ${invoice.customer_email}`,
        date: new Date(invoice.status_transitions!.paid_at! * 1000).toISOString().split('T')[0],
        categoryHierarchy: {
            l0: 'Income',
            l1: 'Rental Income',
            l2: 'Line 3: Rents Received',
            l3: tenantDoc.data().name || invoice.customer_email
        },
        status: 'posted',
        propertyId: associatedPropertyId,
        tenantId: tenantId,
        userId: landlordId,
        bankAccountId: destinationAccountId,
        createdAt: FieldValue.serverTimestamp(),
        source: 'Stripe Webhook'
      });

      // Update the monthly financial stats for the property
      await incrementPropertyStats({
        propertyId: associatedPropertyId,
        date: new Date(invoice.status_transitions!.paid_at! * 1000),
        amount: amountPaid,
        userId: landlordId
      });
      
      console.log(`Successfully recorded payment of $${amountPaid} for tenant ${tenantId}.`);

    } else if (event.type === 'account.updated') {
        const account = event.data.object as Stripe.Account;
        const userId = account.metadata?.firebase_user_id;

        if (userId && account.details_submitted && account.charges_enabled) {
             await db.collection('users').doc(userId).update({
                'billing.stripeStatus': 'active',
                'stripeAccountId': account.id
            });
            console.log(`Stripe Connect account activated for user: ${userId}`);
        }
    }


  } catch (error: any) {
    console.error("Stripe Webhook Error:", error);
    // Return a 500 but still acknowledge receipt to Stripe to prevent retries
    return NextResponse.json({ error: error.message, received: true }, { status: 500 });
  }

  // Acknowledge receipt of the event to Stripe
  return NextResponse.json({ received: true });
}
