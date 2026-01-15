
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { plaidClient } from '@/lib/plaid-client'; 
import { stripe } from '@/lib/stripe';
import { db } from '@/lib/admin-db'; 
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
    const processorTokenResponse = await plaidClient.processorStripeBankAccountTokenCreate({
      access_token: accessToken,
      account_id: accountId,
    });
    const bankAccountToken = processorTokenResponse.data.stripe_bank_account_token;

    // 2. Create Stripe Customer
    const customer = await stripe.customers.create({
      description: 'Omidan Ledger User ' + userId,
      source: bankAccountToken, 
    });

    // 3. Charge the money
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), 
      currency: 'usd',
      customer: customer.id,
      payment_method: customer.default_source as string,
      confirm: true, 
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      return_url: 'https://omidanledger.web.app/dashboard',
    });

    // 4. Record in DB
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
    }

    return NextResponse.json({ 
      success: true, 
      paymentId: paymentIntent.id,
      status: paymentIntent.status 
    });

  } catch (error: any) {
    console.error('Rent payment failed:', error);
    return NextResponse.json({ error: error.message || 'Payment failed' }, { status: 500 });
  }
}
