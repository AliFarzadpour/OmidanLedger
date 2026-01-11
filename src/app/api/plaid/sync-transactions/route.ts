import { NextRequest, NextResponse } from 'next/server';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { db } from '@/lib/firebase-admin'; // Using your Admin SDK

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

    // 1. Get the account from Firestore
    const accountDoc = await db
      .collection('users')
      .doc(userId)
      .collection('bankAccounts')
      .doc(bankAccountId)
      .get();

    const accountData = accountDoc.data();
    // Support both field names to avoid the "accessToken required" error
    const token = accountData?.accessToken || accountData?.plaidAccessToken;

    if (!token) {
      return NextResponse.json({ message: 'accessToken is required' }, { status: 400 });
    }

    // 2. Fetch the latest transactions from Plaid
    const response = await plaidClient.transactionsSync({
      access_token: token,
      cursor: accountData?.plaidCursor || undefined, // Use cursor for efficiency
    });

    const { added, modified, removed, next_cursor } = response.data;

    // 3. Save transactions to Firestore using a batch for safety
    const batch = db.batch();
    
    added.forEach((txn) => {
      // Create a unique doc per transaction to prevent duplicates
      const txnRef = db.collection('users').doc(userId).collection('transactions').doc(txn.transaction_id);
      batch.set(txnRef, {
        ...txn,
        bankAccountId,
        syncedAt: new Date(),
        // Map fields to what your UI expects
        amount: txn.amount,
        date: txn.date,
        description: txn.name,
        category: txn.category?.[0] || 'Uncategorized'
      }, { merge: true });
    });

    // 4. Update the account with the new cursor and status
    const accountRef = db.collection('users').doc(userId).collection('bankAccounts').doc(bankAccountId);
    batch.update(accountRef, {
      plaidCursor: next_cursor,
      lastSyncAt: new Date(),
      linkStatus: 'connected'
    });

    await batch.commit();

    return NextResponse.json({ 
      success: true, 
      addedCount: added.length,
      hasMore: response.data.has_more 
    });
  } catch (error: any) {
    const plaidError = error.response?.data || error.message;
    console.error('PLAID_SYNC_ERROR:', plaidError);
    return NextResponse.json({ message: 'Sync failed' }, { status: 500 });
  }
}
