export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { plaidClient } from '@/lib/plaid';
import { stripe } from '@/lib/stripe';
import { db } from '@/lib/firebase-admin'; // Assuming this is your DB path
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, amount, accountId, accessToken } = body;

    if (!userId || !amount || !accountId || !accessToken) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    console.log('Processing rent payment for user:', userId, 'Amount:', amount);

    // 1. Exchange Plaid Access Token for a Stripe Bank Token
    // This tells the bank: "Allow Stripe to charge this specific account"
    const processorTokenResponse = await plaidClient.processorStripeBankAccountTokenCreate({
      access_token: accessToken,
      account_id: accountId,
    });
    const bankAccountToken = processorTokenResponse.data.stripe_bank_account_token;

    // 2. Create a Stripe Customer (if you haven't already, or use existing)
    // For simplicity, we create a new customer object for this transaction
    const customer = await stripe.customers.create({
      description: 'Omidan Ledger User ' + userId,
      source: bankAccountToken, // Attaches the bank account
    });

    // 3. Charge the money!
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Stripe expects cents (e.g., 0.00 = 5000)
      currency: 'usd',
      customer: customer.id,
      payment_method: customer.default_source as string,
      confirm: true, // Charge it immediately
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never' // ACH Direct Debit usually doesn't redirect
      },
      return_url: 'https://omidanledger.web.app/dashboard', // Required for some flows
    });

    console.log('Stripe Payment Success:', paymentIntent.id);

    // 4. Record the transaction in your database
    // We wrap this in a try-catch so a DB error doesn't hide the fact that money was moved
    try {
        if (db) {
            await db.collection('users').doc(userId).collection('transactions').add({
                type: 'rent_payment',
                amount: amount,
                stripePaymentId: paymentIntent.id,
                status: paymentIntent.status,
                timestamp: FieldValue.serverTimestamp(),
                description: 'Rent Payment via ACH',
            });
        }
    } catch (dbError) {
        console.error('Payment succeeded, but failed to save to DB:', dbError);
        // We continue because the money *was* charged.
    }

    return NextResponse.json({ 
      success: true, 
      paymentId: paymentIntent.id,
      status: paymentIntent.status 
    });

  } catch (error: any) {
    console.error('Rent payment failed:', error);
    return NextResponse.json({ 
      error: error.message || 'Payment processing failed' 
    }, { status: 500 });
  }
}
