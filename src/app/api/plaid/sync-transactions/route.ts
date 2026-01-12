
import { NextRequest, NextResponse } from 'next/server';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { db } from '@/lib/firebase-admin';

const PLAID_ENV = (process.env.PLAID_ENV || 'sandbox') as 'sandbox' | 'development' | 'production';

const configuration = new Configuration({
  basePath: PlaidEnvironments[PLAID_ENV],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID!,
      'PLAID-SECRET': process.env.PLAID_SECRET!,
    },
  },
});

const plaidClient = new PlaidApi(configuration);

export async function POST(req: NextRequest) {
  try {
    const { userId, bankAccountId } = await req.json();

    if (!userId || !bankAccountId) {
      return NextResponse.json({ message: 'userId and bankAccountId are required' }, { status: 400 });
    }

    const accountRef = db.collection('users').doc(userId).collection('bankAccounts').doc(bankAccountId);
    const accountSnap = await accountRef.get();

    if (!accountSnap.exists) {
      return NextResponse.json({ message: 'Bank account not found' }, { status: 404 });
    }

    const accountData = accountSnap.data() || {};
    const accessToken = accountData.accessToken || accountData.plaidAccessToken;

    if (!accessToken) {
      return NextResponse.json({ message: 'accessToken is required' }, { status: 400 });
    }

    let cursor: string | undefined = accountData.plaidCursor || undefined;
    let hasMore = true;

    let addedCount = 0;
    let modifiedCount = 0;
    let removedCount = 0;

    // Loop until Plaid says there is no more data
    while (hasMore) {
      const resp = await plaidClient.transactionsSync({
        access_token: accessToken,
        cursor,
      });

      const { added, modified, removed, next_cursor } = resp.data;

      const batch = db.batch();

      // ✅ Write to the same place the UI reads:
      const txCol = accountRef.collection('transactions');

      for (const txn of added) {
        const txRef = txCol.doc(txn.transaction_id);
        batch.set(
          txRef,
          {
            userId,
            bankAccountId,
            transaction_id: txn.transaction_id,
            date: txn.date,
            description: txn.name,
            amount: txn.amount,
            merchant_name: txn.merchant_name || null,
            pending: txn.pending || false,
            category: txn.category || null,
            category_id: txn.category_id || null,
            account_id: txn.account_id,
            iso_currency_code: txn.iso_currency_code || null,
            unofficial_currency_code: txn.unofficial_currency_code || null,
            syncedAt: new Date(),
          },
          { merge: true }
        );
      }

      // (Optional) handle modified/removed if you want:
      // modified -> batch.set(txRef, {...}, {merge:true})
      // removed -> batch.delete(txRef)

      // Update cursor on the bank account doc each loop
      batch.set(
        accountRef,
        {
          plaidCursor: next_cursor,
          lastSyncAt: new Date(),
          linkStatus: 'connected',
        },
        { merge: true }
      );

      await batch.commit();

      addedCount += added.length;
      modifiedCount += modified.length;
      removedCount += removed.length;

      cursor = next_cursor;
      hasMore = resp.data.has_more === true;
    }

    return NextResponse.json({
      success: true,
      addedCount,
      modifiedCount,
      removedCount,
    });
  } catch (error: any) {
    const plaidError = error.response?.data || error.message;
    console.error('PLAID_SYNC_ERROR:', plaidError);
    return NextResponse.json({ message: plaidError?.error_message || 'Sync failed' }, { status: 500 });
  }
}
