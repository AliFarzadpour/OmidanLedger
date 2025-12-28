
'use server';

import Stripe from 'stripe';

// Initialize Stripe with the secret key from environment variables
// Ensure STRIPE_SECRET_KEY is set in your .env file
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

interface CreateTenantInvoiceData {
  landlordAccountId: string;
  tenantEmail: string;
  amount: number;
  description: string;
}

/**
 * This server action creates and sends a Stripe invoice to a tenant
 * on behalf of a connected landlord account.
 */
export async function createTenantInvoice(data: CreateTenantInvoiceData) {
  const { landlordAccountId, tenantEmail, amount, description } = data;

  // DEBUG LOG
  console.log("?? STRIPE INVOICE DEBUG", {
    stripeAccountIdUsed: landlordAccountId,
  });

  if (!landlordAccountId || !tenantEmail || !amount || !description) {
    throw new Error('Missing required invoice data.');
  }

  try {
    // 1. Create or retrieve the Tenant as a Stripe Customer on the Landlord's account
    const customer = await stripe.customers.create({
      email: tenantEmail,
    }, { stripeAccount: landlordAccountId });

    // 2. Create the Invoice in a draft state first
    const invoice = await stripe.invoices.create({
      customer: customer.id,
      collection_method: 'send_invoice',
      description: description, // Add the description to the invoice itself
      auto_advance: false, // Keep it as a draft
    }, { stripeAccount: landlordAccountId });

    // 3. Create an Invoice Item and link it to the draft invoice
    await stripe.invoiceItems.create({
      customer: customer.id,
      invoice: invoice.id,
      amount: Math.round(amount * 100), // Stripe uses cents, ensure it's an integer
      currency: 'usd',
      description: description,
    }, { stripeAccount: landlordAccountId });

    // 4. Finalize the invoice so it can be paid
    const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id, { stripeAccount: landlordAccountId });
    
    // CRITICAL: Retrieve the invoice again after finalization to get the hosted_invoice_url
    const sentInvoice = await stripe.invoices.retrieve(finalizedInvoice.id, {
        stripeAccount: landlordAccountId,
    });

    if (!sentInvoice.hosted_invoice_url) {
        throw new Error("Failed to retrieve the hosted invoice URL after finalization.");
    }

    return { success: true, invoiceUrl: sentInvoice.hosted_invoice_url };
    
  } catch (error: any) {
    console.error("Stripe Invoicing Error:", error);
    // Re-throw a more user-friendly error to be caught by the client
    throw new Error(error.message || 'An internal error occurred while creating the invoice.');
  }
}
