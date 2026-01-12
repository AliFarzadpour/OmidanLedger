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

    // 1) Load bank account doc
    const accountRef = db.collection('users').doc(userId).collection('bankAccounts').doc(bankAccountId);
    const accountSnap = await accountRef.get();

    if (!accountSnap.exists) {
      return NextResponse.json({ message: 'Bank account not found' }, { status: 404 });
    }

    const accountData = accountSnap.data() || {};
    const token = accountData.accessToken || accountData.plaidAccessToken;
    const plaidAccountId = accountData.plaidAccountId; // used to prevent "wrong account" mixing

    if (!token) {
      return NextResponse.json({ message: 'accessToken is required' }, { status: 400 });
    }

    // Support either cursor field name (old/new)
    let cursor: string | null = accountData.plaidCursor || accountData.plaidSyncCursor || null;

    // 2) Paginate Plaid sync until has_more is false (with safety caps)
    let pages = 0;
    const MAX_PAGES = 25;       // safety cap
    const MAX_WRITES = 10000;   // safety cap

    let totalWritten = 0;
    let totalAddedWritten = 0;
    let totalModifiedWritten = 0;
    let totalRemoved = 0;

    let hasMore = true;
    let lastNextCursor: string | null = cursor;

    while (hasMore) {
      pages += 1;
      if (pages > MAX_PAGES) break;
      if (totalWritten > MAX_WRITES) break;

      const resp = await plaidClient.transactionsSync({
        access_token: token,
        cursor: lastNextCursor || undefined,
      });

      const { added, modified, removed, next_cursor, has_more } = resp.data;

      // Write this page using a batch
      const batch = db.batch();

      // Upsert ADDED
      for (const txn of added) {
        // Prevent wrong-account contamination if we know which plaidAccountId we want
        if (plaidAccountId && txn.account_id && txn.account_id !== plaidAccountId) continue;

        const txRef = accountRef.collection('transactions').doc(txn.transaction_id);
        batch.set(txRef, {
          ...txn,
          userId,
          bankAccountId,
          plaidAccountId: txn.account_id || plaidAccountId || null,
          description: txn.name,
          syncedAt: new Date(),
          source: 'plaid',
        }, { merge: true });

        totalWritten += 1;
        totalAddedWritten += 1;
      }

      // Upsert MODIFIED
      for (const txn of modified) {
        if (plaidAccountId && txn.account_id && txn.account_id !== plaidAccountId) continue;

        const txRef = accountRef.collection('transactions').doc(txn.transaction_id);
        batch.set(txRef, {
          ...txn,
          userId,
          bankAccountId,
          plaidAccountId: txn.account_id || plaidAccountId || null,
          description: txn.name,
          syncedAt: new Date(),
          source: 'plaid',
        }, { merge: true });

        totalWritten += 1;
        totalModifiedWritten += 1;
      }

      // Delete REMOVED
      for (const r of removed) {
        const txRef = accountRef.collection('transactions').doc(r.transaction_id);
        batch.delete(txRef);
        totalRemoved += 1;
      }

      // Update cursor & timestamps each page (safe + resumable)
      batch.set(accountRef, {
        plaidCursor: next_cursor,
        lastSyncAt: new Date(),
        linkStatus: 'connected',
      }, { merge: true });

      await batch.commit();

      lastNextCursor = next_cursor;
      hasMore = !!has_more;
    }

    return NextResponse.json({
      success: true,

      // ✅ These now reflect what you actually wrote
      count: totalWritten,
      addedWritten: totalAddedWritten,
      modifiedWritten: totalModifiedWritten,
      removed: totalRemoved,

      pages,
      cursor: lastNextCursor,
      hasMore,
    });

  } catch (error: any) {
    const plaidError = error.response?.data || error.message;
    console.error('PLAID_SYNC_ERROR:', plaidError);
    return NextResponse.json({ message: 'Sync failed' }, { status: 500 });
  }
}