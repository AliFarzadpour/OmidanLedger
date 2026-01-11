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

      // 3. Save transactions to Firestore under the bank account subcollection (matches UI)
      const batch = db.batch();

      const txCol = db
        .collection('users')
        .doc(userId)
        .collection('bankAccounts')
        .doc(bankAccountId)
        .collection('transactions');

      const upsert = (txn: any) => {
        const txnRef = txCol.doc(txn.transaction_id);
        batch.set(txnRef, {
          // required for collectionGroup query + analytics
          userId,

          // linking fields
          bankAccountId,
          plaidAccountId: txn.account_id,
          plaidTransactionId: txn.transaction_id,

          // UI fields
          amount: txn.amount,
          date: txn.date,
          description: txn.name,

          // default categories (your UI expects this object)
          categoryHierarchy: {
            l0: 'EXPENSE',
            l1: 'Uncategorized',
            l2: 'Uncategorized',
            l3: '',
          },

          status: 'review',
          reviewStatus: 'needs-review',
          confidence: 0.5,

          // keep raw for troubleshooting
          raw: txn,

          syncedAt: new Date(),
        }, { merge: true });
      };

      added.forEach(upsert);
      modified.forEach(upsert);

      // Removed transactions
      removed.forEach((r: any) => {
        const txnRef = txCol.doc(r.transaction_id);
        batch.delete(txnRef);
      });

      // 4. Update the account with the new cursor + last sync time (match UI)
      const accountRef = db.collection('users').doc(userId).collection('bankAccounts').doc(bankAccountId);
      batch.update(accountRef, {
        plaidCursor: next_cursor,
        lastSyncedAt: new Date(),
        linkStatus: 'connected'
      });

      await batch.commit();

      return NextResponse.json({
        success: true,
        count: added.length,
        addedCount: added.length,
        modifiedCount: modified.length,
        removedCount: removed.length,
        hasMore: response.data.has_more
      });
    } catch (error: any) {
      const plaidError = error.response?.data || error.message;
      console.error('PLAID_SYNC_ERROR:', plaidError);
      return NextResponse.json({ message: 'Sync failed' }, { status: 500 });
    }
  }
