'use server';
import { NextRequest, NextResponse } from 'next/server';
import { PlaidApi, Configuration, PlaidEnvironments } from 'plaid';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

const db = getAdminDb();

const plaidClient = new PlaidApi(
  new Configuration({
    basePath: PlaidEnvironments[process.env.PLAID_ENV || 'production'], // Ensure this defaults to production if env is missing
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID!,
        'PLAID-SECRET': process.env.PLAID_SECRET!,
      },
    },
  })
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { webhook_type, webhook_code, item_id } = body;

    console.log(`[Plaid Webhook] Received: ${webhook_type} - ${webhook_code} | Item: ${item_id}`);

    // --- FILTER: We only want standard updates ---
    if (webhook_type !== 'TRANSACTIONS') {
      return NextResponse.json({ status: 'ignored', reason: 'Not a transactions webhook' });
    }

    if (webhook_code !== 'DEFAULT_UPDATE' && webhook_code !== 'SYNC_UPDATES_AVAILABLE') {
       return NextResponse.json({ status: 'ignored', reason: 'Not a relevant update code' });
    }

    // 1. Find the user/token associated with this item_id
    // Note: Ensure your 'bankAccounts' documents actually contain the 'plaidAccessToken' field.
    const accountsQuery = await db.collectionGroup('bankAccounts').where('plaidItemId', '==', item_id).limit(1).get();

    if (accountsQuery.empty) {
      console.warn(`[Plaid Webhook] No account found for item_id: ${item_id}`);
      return NextResponse.json({ status: 'error', message: 'Account not found' }, { status: 404 });
    }

    const accountDoc = accountsQuery.docs[0];
    const { userId, plaidAccessToken } = accountDoc.data();

    if (!userId || !plaidAccessToken) {
      console.error(`[Plaid Webhook] Missing userId or accessToken for item_id: ${item_id}`);
      return NextResponse.json({ status: 'error', message: 'Missing credentials in DB' }, { status: 500 });
    }

    // 2. Fetch the latest balances (FREE METHOD)
    // We use accountsGet because the webhook tells us Plaid just updated its cache.
    // We do NOT need to pay for accountsBalanceGet here.
    const response = await plaidClient.accountsGet({ access_token: plaidAccessToken });

    const batch = db.batch();

    // 3. Update Firestore
    // We loop through the accounts returned by Plaid to ensure we update all accounts under this Item
    for (const account of response.data.accounts) {
        const balanceData = {
          currentBalance: account.balances.current,
          availableBalance: account.balances.available,
          currency: account.balances.iso_currency_code,
          lastUpdatedAt: Timestamp.now(),
          source: 'plaid-webhook-free', // Tagged so you know it worked
          plaidAccountId: account.account_id
        };

        // Caution: Ensure this path matches your DB structure exactly
        const balanceDocRef = db.collection('users').doc(userId).collection('bankBalances').doc(account.account_id);
        
        batch.set(balanceDocRef, balanceData, { merge: true });
    }

    await batch.commit();
    console.log(`[Plaid Webhook] Successfully updated ${response.data.accounts.length} balances via Free API for item: ${item_id}`);

    return NextResponse.json({ status: 'success' });

  } catch (error: any) {
    console.error('[Plaid Webhook] Error:', error.response?.data || error.message);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}