
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

    // Build a map: Plaid account_id -> Firestore bankAccount docId
    const allAccountsSnap = await db
      .collection('users')
      .doc(userId)
      .collection('bankAccounts')
      .where('plaidItemId', '==', accountData.plaidItemId)
      .get();

    const plaidAccountIdToDocId: Record<string, string> = {};
    allAccountsSnap.forEach((docSnap) => {
      const d = docSnap.data() as any;
      if (d?.plaidAccountId) {
        plaidAccountIdToDocId[d.plaidAccountId] = docSnap.id;
      }
    });

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

      for (const txn of added) {
        const targetBankAccountDocId = plaidAccountIdToDocId[txn.account_id] || bankAccountId;
        const txnRef = db
          .collection('users')
          .doc(userId)
          .collection('bankAccounts')
          .doc(targetBankAccountDocId)
          .collection('transactions')
          .doc(txn.transaction_id);

        batch.set(
          txnRef,
          {
            userId,
            bankAccountId: targetBankAccountDocId,
            plaidAccountId: txn.account_id,
            transaction_id: txn.transaction_id,
            date: txn.date,
            description: txn.name,
            amount: txn.amount,
            syncedAt: new Date(),
          },
          { merge: true }
        );
      }

      for (const txn of modified) {
        const targetBankAccountDocId = plaidAccountIdToDocId[txn.account_id] || bankAccountId;
        const txnRef = db
          .collection('users')
          .doc(userId)
          .collection('bankAccounts')
          .doc(targetBankAccountDocId)
          .collection('transactions')
          .doc(txn.transaction_id);
        
        batch.set(
          txnRef,
          {
            userId,
            bankAccountId: targetBankAccountDocId,
            plaidAccountId: txn.account_id,
            transaction_id: txn.transaction_id,
            date: txn.date,
            description: txn.name,
            amount: txn.amount,
            syncedAt: new Date(),
          },
          { merge: true }
        );
      }
      
      for (const r of removed) {
        // Since we don't know which account it belonged to, we might need a collectionGroup query to find it.
        // For simplicity, we'll assume it's from the primary account for now.
        const txRef = accountRef.collection('transactions').doc(r.transaction_id);
        batch.delete(txRef);
      }

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
