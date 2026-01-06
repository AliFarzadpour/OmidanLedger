
'use server';

import { db } from '@/lib/admin-db';
import { revalidatePath } from 'next/cache';
import Stripe from 'stripe';
import { FieldValue } from 'firebase-admin/firestore';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});


// Updated interface to match the new form fields
export async function updateUserBillingConfig(userId: string, config: {
  minFee: number;
  unitCap: number;
  transactionFeePercent: number;
  subscriptionTier: string;
}) {
  
  try {
    // Update the user document with the new billing structure
    await db.collection('users').doc(userId).update({
      'billing.minFee': config.minFee,
      'billing.unitCap': config.unitCap,
      'billing.transactionFeePercent': config.transactionFeePercent,
      'billing.subscriptionTier': config.subscriptionTier,
      'billing.status': config.subscriptionTier !== 'free' ? 'active' : 'trialing',
      'billing.updatedAt': new Date()
    });
    
    // revalidatePath is server-side, it's better to reload on the client
    // revalidatePath('/admin/users'); 
    return { success: true };
  } catch (error: any) {
    console.error("Failed to update billing:", error);
    throw new Error(error.message);
  }
}

/**
 * Creates and sends a Stripe invoice from the admin to a landlord user.
 */
export async function sendLandlordInvoice(data: {
  userId: string;
  userEmail: string;
  amount: number;
  billingPeriod: string;
}) {
  const { userId, userEmail, amount, billingPeriod } = data;

  if (!userEmail || !amount || amount <= 0) {
    throw new Error('Missing required data to create an invoice.');
  }

  try {
    // 1. Find or create a Stripe Customer for the landlord
    let customer;
    const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
    if (customers.data.length > 0) {
      customer = customers.data[0];
    } else {
      customer = await stripe.customers.create({
        email: userEmail,
        name: userEmail,
        metadata: { firebase_uid: userId },
      });
    }

    // 2. Create an Invoice Item
    const invoiceItem = await stripe.invoiceItems.create({
      customer: customer.id,
      amount: Math.round(amount * 100), // Stripe expects amount in cents
      currency: 'usd',
      description: `Subscription Fee for ${billingPeriod}`,
    });

    // 3. Create the Invoice
    const invoice = await stripe.invoices.create({
      customer: customer.id,
      collection_method: 'send_invoice',
      days_until_due: 15,
      auto_advance: true, // Automatically finalize and send
      metadata: {
        firebase_uid: userId,
        billing_period: billingPeriod,
      },
    });

    // 4. Log the sent invoice in Firestore for tracking
    const adminInvoiceRef = db.collection('users').doc(userId).collection('admin_invoices').doc(invoice.id);
    await adminInvoiceRef.set({
      stripeInvoiceId: invoice.id,
      stripeCustomerId: customer.id,
      amount: amount,
      status: 'open',
      billingPeriod: billingPeriod,
      sentAt: FieldValue.serverTimestamp(),
      invoiceUrl: invoice.hosted_invoice_url,
    });
    
    // The invoice is sent automatically by Stripe.

    return { success: true, invoiceId: invoice.id, invoiceUrl: invoice.hosted_invoice_url };
  } catch (error: any) {
    console.error('Stripe invoice creation failed:', error);
    throw new Error(error.message || 'An internal error occurred with Stripe.');
  }
}
