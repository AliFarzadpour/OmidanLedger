
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, bankAccountId, fullSync, startDate } = body as {
      userId: string;
      bankAccountId: string;
      fullSync?: boolean;
      startDate?: string; // YYYY-MM-DD
    };

    if (!userId || !bankAccountId) {
      return NextResponse.json({ message: 'userId and bankAccountId are required' }, { status: 400 });
    }

    const db = ensureAdmin();

    // 🔑 Load the ONE bank account doc the user selected
    const bankRef = db.doc(`users/${userId}/bankAccounts/${bankAccountId}`);
    const bankSnap = await bankRef.get();
    if (!bankSnap.exists) {
      return NextResponse.json({ message: 'Bank account not found' }, { status: 404 });
    }

    const bank = bankSnap.data() || {};
    const accessToken: string | undefined = bank.plaidAccessToken || bank.accessToken;
    const plaidAccountId: string | undefined = bank.plaidAccountId;

    if (!accessToken) {
      return NextResponse.json({ message: 'accessToken is required (missing plaidAccessToken/accessToken on this bankAccount doc)' }, { status: 400 });
    }
    if (!plaidAccountId) {
      return NextResponse.json({ message: 'plaidAccountId is required on this bankAccount doc' }, { status: 400 });
    }

    const txCol = db.collection(`users/${userId}/bankAccounts/${bankAccountId}/transactions`);

    // ---------------------------------------------
    // A) FULL REBUILD (historical backfill)
    // Uses /transactions/get (supports options.account_ids)
    // ---------------------------------------------
    if (fullSync) {
      const start = startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate : `${new Date().getFullYear()}-01-01`;
      const end = toISODate(new Date());

      // Optional: clear existing transactions for this account
      // (You can skip clearing if you prefer upsert-only.)
      // We'll clear in manageable batches.
      const existing = await txCol.limit(500).get();
      let cleared = 0;
      while (!existing.empty) {
        const batch = db.batch();
        existing.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        cleared += existing.size;
        const next = await txCol.limit(500).get();
        if (next.empty) break;
      }

      let offset = 0;
      const count = 500;
      let saved = 0;

      while (true) {
        const resp = await plaidClient.transactionsGet({
          access_token: accessToken,
          start_date: start,
          end_date: end,
          options: {
            account_ids: [plaidAccountId], // ✅ valid for transactions/get
            count,
            offset,
          },
        });

        const txns = resp.data.transactions || [];
        if (txns.length === 0) break;

        const batch = db.batch();
        for (const t of txns) {
          // Extra safety: only save this account
          if (t.account_id !== plaidAccountId) continue;

          const ref = txCol.doc(t.transaction_id);
          batch.set(
            ref,
            {
              id: t.transaction_id,
              userId,
              bankAccountId,
              plaidAccountId: t.account_id,
              date: t.date,
              description: t.name ?? t.merchant_name ?? 'Transaction',
              amount: -1 * Number(t.amount ?? 0), // Plaid amount is usually positive for outflow; normalize if you want
              category: t.category ?? [],
              merchantName: t.merchant_name ?? null,
              pending: t.pending ?? false,
              raw: t, // keep raw for debugging
              // your app fields (optional defaults)
              reviewStatus: 'needs-review',
              status: 'posted',
              confidence: 0.5,
            },
            { merge: true }
          );
          saved++;
        }

        await batch.commit();

        offset += txns.length;
        const total = resp.data.total_transactions ?? 0;
        if (offset >= total) break;
      }

      await bankRef.set(
        {
          lastSyncAt: admin.firestore.FieldValue.serverTimestamp(),
          lastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
          historicalDataPending: false,
          // after rebuild, reset incremental cursor to null so future sync starts clean
          plaidSyncCursor: null,
        },
        { merge: true }
      );

      return NextResponse.json({ count: saved, start_date: start, cleared });
    }

    // ---------------------------------------------
    // B) NORMAL SYNC (incremental)
    // Uses /transactions/sync (does NOT support options.account_ids)
    // We FILTER locally by tx.account_id === plaidAccountId
    // ---------------------------------------------
    let cursor: string | null = bank.plaidSyncCursor ?? null;
    let hasMore = true;
    let addedCount = 0;

    while (hasMore) {
      const resp = await plaidClient.transactionsSync({
        access_token: accessToken,
        cursor: cursor || undefined,
        count: 500,
        // ✅ NO options.account_ids here (Plaid rejects it)
      });

      const data = resp.data;

      const batch = db.batch();

      // Save only the selected account’s transactions
      for (const t of data.added || []) {
        if (t.account_id !== plaidAccountId) continue;
        batch.set(
          txCol.doc(t.transaction_id),
          {
            id: t.transaction_id,
            userId,
            bankAccountId,
            plaidAccountId: t.account_id,
            date: t.date,
            description: t.name ?? t.merchant_name ?? 'Transaction',
            amount: -1 * Number(t.amount ?? 0),
            category: t.category ?? [],
            merchantName: t.merchant_name ?? null,
            pending: t.pending ?? false,
            raw: t,
            reviewStatus: 'needs-review',
            status: 'posted',
            confidence: 0.5,
          },
          { merge: true }
        );
        addedCount++;
      }

      for (const t of data.modified || []) {
        if (t.account_id !== plaidAccountId) continue;
        batch.set(
          txCol.doc(t.transaction_id),
          {
            id: t.transaction_id,
            userId,
            bankAccountId,
            plaidAccountId: t.account_id,
            date: t.date,
            description: t.name ?? t.merchant_name ?? 'Transaction',
            amount: -1 * Number(t.amount ?? 0),
            category: t.category ?? [],
            merchantName: t.merchant_name ?? null,
            pending: t.pending ?? false,
            raw: t,
          },
          { merge: true }
        );
      }

      for (const r of data.removed || []) {
        // removed items can come from other accounts too; safe to delete by id only if it exists here
        batch.delete(txCol.doc(r.transaction_id));
      }

      await batch.commit();

      cursor = data.next_cursor;
      hasMore = !!data.has_more;
    }

    await bankRef.set(
      {
        plaidSyncCursor: cursor,
        lastSyncAt: admin.firestore.FieldValue.serverTimestamp(),
        lastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ count: addedCount });
  } catch (error: any) {
    const errorData = error?.response?.data || error?.message || String(error);
    console.error('PLAID_SYNC_ERROR:', errorData);
    return NextResponse.json({ message: errorData?.error_message || errorData }, { status: 500 });
  }
}
