import { NextRequest, NextResponse } from 'next/server';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import admin from 'firebase-admin';

function ensureAdmin() {
  if (!admin.apps.length) {
    const json = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!json) throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_KEY');
    const serviceAccount = JSON.parse(json);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
  return admin.firestore();
}

const plaidClient = new PlaidApi(
  new Configuration({
    basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID!,
        'PLAID-SECRET': process.env.PLAID_SECRET!,
      },
    },
  })
);

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Plaid amounts are typically positive for outflow. We store bookkeeping-friendly:
// outflow = negative, inflow = positive.
function normalizeAmount(plaidAmount: number) {
  return -1 * Number(plaidAmount || 0);
}

export async function POST(req: NextRequest) {
  try {
    const { userId, bankAccountId, startDate } = await req.json();

    if (!userId) return NextResponse.json({ message: 'userId is required' }, { status: 400 });
    if (!bankAccountId) return NextResponse.json({ message: 'bankAccountId is required' }, { status: 400 });

    const db = ensureAdmin();

    const acctRef = db.doc(`users/${userId}/bankAccounts/${bankAccountId}`);
    const acctSnap = await acctRef.get();
    if (!acctSnap.exists) {
      return NextResponse.json({ message: 'bank account not found' }, { status: 404 });
    }

    const acct = acctSnap.data() as any;

    const accessToken = acct.plaidAccessToken || acct.accessToken;
    const plaidAccountId = acct.plaidAccountId || bankAccountId;

    if (!accessToken) {
      return NextResponse.json({ message: 'accessToken is required' }, { status: 400 });
    }

    const txCol = db.collection(`users/${userId}/bankAccounts/${bankAccountId}/transactions`);
    let savedCount = 0;

    // ✅ BACKFILL MODE: if startDate provided, use /transactions/get with account_ids
    if (startDate) {
      const endDate = toISODate(new Date());
      let offset = 0;
      const count = 500;

      while (true) {
        const resp = await plaidClient.transactionsGet({
          access_token: accessToken,
          start_date: startDate,
          end_date: endDate,
          options: {
            account_ids: [plaidAccountId], // ✅ VALID here
            count,
            offset,
          },
        });

        const txs = resp.data.transactions || [];
        for (const t of txs) {
          const docId = t.transaction_id;
          await txCol.doc(docId).set(
            {
              userId,
              bankAccountId,
              date: t.date,
              description: t.merchant_name || t.name || 'Transaction',
              amount: normalizeAmount(t.amount),
              categoryHierarchy: { l0: 'Uncategorized', l1: '', l2: '', l3: '' },
              confidence: 0,
              status: 'review',
              reviewStatus: 'needs-review',
              plaidTransactionId: t.transaction_id,
              plaidAccountId: t.account_id,
              lastUpdatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
          savedCount++;
        }

        offset += txs.length;
        if (offset >= (resp.data.total_transactions || 0) || txs.length === 0) break;
      }

      await acctRef.set(
        { lastSyncAt: FieldValue.serverTimestamp(), lastSyncedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );

      return NextResponse.json({ ok: true, mode: 'backfill', count: savedCount });
    }

    // ✅ INCREMENTAL MODE: /transactions/sync (NO options.account_ids — that causes your error)
    let cursor: string | null = acct.plaidSyncCursor || null;
    let hasMore = true;

    while (hasMore) {
      const resp = await plaidClient.transactionsSync({
        access_token: accessToken,
        cursor: cursor || undefined,
        count: 500,
      });

      cursor = resp.data.next_cursor;
      hasMore = resp.data.has_more;

      const added = (resp.data.added || []).filter((t) => t.account_id === plaidAccountId);
      const modified = (resp.data.modified || []).filter((t) => t.account_id === plaidAccountId);

      const upserts = [...added, ...modified];

      for (const t of upserts) {
        const docId = t.transaction_id;
        await txCol.doc(docId).set(
          {
            userId,
            bankAccountId,
            date: t.date,
            description: t.merchant_name || t.name || 'Transaction',
            amount: normalizeAmount(t.amount),
            categoryHierarchy: { l0: 'Uncategorized', l1: '', l2: '', l3: '' },
            confidence: 0,
            status: 'review',
            reviewStatus: 'needs-review',
            plaidTransactionId: t.transaction_id,
            plaidAccountId: t.account_id,
            lastUpdatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        savedCount++;
      }
    }

    await acctRef.set(
      {
        plaidSyncCursor: cursor,
        lastSyncAt: FieldValue.serverTimestamp(),
        lastSyncedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true, mode: 'incremental', count: savedCount });
  } catch (error: any) {
    console.error('SYNC_TRANSACTIONS_ERROR:', error?.response?.data || error?.message || error);
    const msg = error?.response?.data?.error_message || error?.message || 'Failed to sync transactions';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
