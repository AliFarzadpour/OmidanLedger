
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

    // 1) Load the selected bank account doc
    const accountRef = db.collection('users').doc(userId).collection('bankAccounts').doc(bankAccountId);
    const accountDoc = await accountRef.get();
    const accountData = accountDoc.data();

    if (!accountData) {
      return NextResponse.json({ message: 'Bank account not found' }, { status: 404 });
    }
    
    // --- START: Calculate Start Date ---
    const importStart = accountData.importStart || 'lastYear';
    const now = new Date();
    const startDate =
      importStart === 'thisYear'
        ? new Date(now.getFullYear(), 0, 1)
        : new Date(now.getFullYear() - 1, 0, 1);
    const startYmd = startDate.toISOString().slice(0, 10); // "YYYY-MM-DD"
    // --- END: Calculate Start Date ---


    // This is the CRITICAL field used to keep transactions inside THIS card
    const selectedPlaidAccountId: string | undefined = accountData.plaidAccountId;
    if (!selectedPlaidAccountId) {
      return NextResponse.json(
        { message: 'This card is missing plaidAccountId. Re-link this account.' },
        { status: 400 }
      );
    }

    // Use whatever token you have (you currently store it on the bankAccount doc)
    const token: string | undefined = accountData.accessToken || accountData.plaidAccessToken;
    if (!token) {
      return NextResponse.json({ message: 'accessToken is required' }, { status: 400 });
    }

    // Use ONE cursor field consistently
    let cursor: string | undefined = accountData.plaidSyncCursor || undefined;

    // 2) Pull ALL pages (Plaid returns in chunks; has_more indicates more pages)
    let addedCount = 0;
    let totalFetched = 0;
    let hasMore = true;

    while (hasMore) {
      const resp = await plaidClient.transactionsSync({
        access_token: token,
        cursor,
      });

      const { added, modified, removed, next_cursor, has_more } = resp.data;

      cursor = next_cursor;
      hasMore = has_more;

      // 3) Filter to ONLY transactions that belong to the selected account_id AND are after the start date
      const mineAdded = (added || []).filter(t =>
        t.account_id === selectedPlaidAccountId && t.date >= startYmd
      );
      const mineModified = (modified || []).filter(t =>
        t.account_id === selectedPlaidAccountId && t.date >= startYmd
      );

      totalFetched += (added?.length || 0) + (modified?.length || 0) + (removed?.length || 0);

      // 4) Write ONLY into users/{uid}/bankAccounts/{bankAccountId}/transactions
      const batch = db.batch();

      for (const txn of mineAdded) {
        const txnRef = accountRef.collection('transactions').doc(txn.transaction_id);
        batch.set(txnRef, {
          userId,
          bankAccountId,
          plaidAccountId: txn.account_id,
          transaction_id: txn.transaction_id,
          date: txn.date,
          description: txn.name,
          amount: txn.amount,
          raw: txn, // keep full Plaid payload
          syncedAt: new Date(),
        }, { merge: true });
      }

      for (const txn of mineModified) {
        const txnRef = accountRef.collection('transactions').doc(txn.transaction_id);
        batch.set(txnRef, {
          userId,
          bankAccountId,
          plaidAccountId: txn.account_id,
          transaction_id: txn.transaction_id,
          date: txn.date,
          description: txn.name,
          amount: txn.amount,
          raw: txn,
          syncedAt: new Date(),
        }, { merge: true });
      }

      // Remove (only if those removed belong to this account — often you don’t need to delete, but this keeps it clean)
      for (const r of (removed || [])) {
        // Plaid removed entries sometimes don’t include account_id; safe delete by transaction_id if it exists
        if (r.transaction_id) {
          const txnRef = accountRef.collection('transactions').doc(r.transaction_id);
          batch.delete(txnRef);
        }
      }

      // Update THIS card’s cursor + sync timestamp
      batch.set(accountRef, {
        plaidSyncCursor: cursor,
        lastSyncAt: new Date(),
        linkStatus: 'connected',
      }, { merge: true });

      await batch.commit();

      addedCount += mineAdded.length;
    }

    return NextResponse.json({
      success: true,
      addedCount,
      totalFetchedFromPlaid: totalFetched,
    });
  } catch (error: any) {
    const plaidError = error.response?.data || error.message;
    console.error('PLAID_SYNC_ERROR:', plaidError);
    return NextResponse.json(
      { message: plaidError?.error_message || plaidError || 'Sync failed' },
      { status: 500 }
    );
  }
}
