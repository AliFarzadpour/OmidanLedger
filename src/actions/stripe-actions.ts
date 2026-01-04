
'use server';

import Stripe from 'stripe';
import { db } from '@/lib/admin-db';
import { FieldValue } from 'firebase-admin/firestore';

// Initialize Stripe with the secret key from environment variables
// Ensure STRIPE_SECRET_KEY is set in your .env file
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

interface CreateTenantInvoiceData {
  userId: string; // NEW: Landlord's user ID
  landlordAccountId: string;
  tenantEmail: string;
  tenantPhone?: string;
  amount: number;
  description: string;
  propertyName?: string;
}

/**
 * This server action creates and sends a Stripe invoice to a tenant
 * on behalf of a connected landlord account.
 */
export async function createTenantInvoice(data: CreateTenantInvoiceData) {
  const { userId, landlordAccountId, tenantEmail, tenantPhone, amount, description, propertyName } = data;
  
  const now = new Date();
  const month = now.toLocaleString('default', { month: 'long' });
  const year = now.getFullYear();
  
  // Construct a more detailed description
  let fullDescription = `${description} for ${month} ${year}`;
  if (propertyName) {
    fullDescription += ` at ${propertyName}`;
  }


  // DEBUG LOG
  console.log("?? STRIPE INVOICE DEBUG", {
    stripeAccountIdUsed: landlordAccountId,
  });

  if (!landlordAccountId || !tenantEmail || !amount || !description || !userId) {
    throw new Error('Missing required invoice data.');
  }

  try {
    // 1. Create or retrieve the Tenant as a Stripe Customer on the Landlord's account
    const customer = await stripe.customers.create({
      email: tenantEmail,
      phone: tenantPhone,
      metadata: {
          property: propertyName || 'N/A'
      }
    }, { stripeAccount: landlordAccountId });

    // 2. Create the Invoice in a draft state first
    const invoice = await stripe.invoices.create({
      customer: customer.id,
      collection_method: 'send_invoice',
      description: fullDescription, // Add the description to the invoice itself
      auto_advance: false, // Keep it as a draft
      days_until_due: 7, // Specify a due date
    }, { stripeAccount: landlordAccountId });

    // 3. Create an Invoice Item and link it to the draft invoice
    await stripe.invoiceItems.create({
      customer: customer.id,
      invoice: invoice.id,
      amount: Math.round(amount * 100), // Stripe uses cents, ensure it's an integer
      currency: 'usd',
      description: fullDescription,
    }, { stripeAccount: landlordAccountId });

    // 4. Finalize the invoice so it can be paid
    const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id, { 
      stripeAccount: landlordAccountId 
    });
        
    // 5. CRITICAL: Send the finalizedInvoice to the customer
    const sentInvoice = await stripe.invoices.sendInvoice(finalizedInvoice.id, {
        stripeAccount: landlordAccountId,
    });

    if (!sentInvoice.hosted_invoice_url) {
        throw new Error("Failed to retrieve the hosted invoice URL after sending.");
    }
    
    // 6. NEW: Log the charge in Firestore for tracking
    const chargeRef = db.collection('users').doc(userId).collection('charges').doc();
    await chargeRef.set({
        id: chargeRef.id,
        tenantEmail,
        propertyName,
        amount,
        description: fullDescription,
        sentAt: FieldValue.serverTimestamp(),
        stripeInvoiceId: sentInvoice.id,
        status: 'sent',
    });


    return { success: true, invoiceUrl: sentInvoice.hosted_invoice_url };
      
  } catch (error: any) {
    console.error("Stripe Invoicing Error:", error);
    // Re-throw a more user-friendly error to be caught by the client
    throw new Error(error.message || 'An internal error occurred while creating the invoice.');
  }
}
