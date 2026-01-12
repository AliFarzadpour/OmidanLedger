import { NextRequest, NextResponse } from 'next/server';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export const runtime = 'nodejs';

// ---------- Firebase Admin ----------
function initAdmin() {
  if (getApps().length) return;
  // You must already have these set in Firebase App Hosting env vars
  // FIREBASE_SERVICE_ACCOUNT_KEY should be a JSON string of the service account
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!json) throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_KEY env var');
  initializeApp({ credential: cert(JSON.parse(json)) });
}

function db() {
  initAdmin();
  return getFirestore();
}

// ---------- Plaid Client ----------
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

// ---------- Helpers ----------
function toYYYYMMDD(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function deleteAllTransactionsForAccount(userId: string, bankAccountId: string) {
  const firestore = db();
  const col = firestore.collection(`users/${userId}/bankAccounts/${bankAccountId}/transactions`);

  while (true) {
    const snap = await col.limit(400).get();
    if (snap.empty) break;

    const batch = firestore.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

type NormalizedTx = {
  id: string;
  userId: string;
  bankAccountId: string;
  plaidTransactionId: string;
  plaidAccountId: string;
  date: string;
  description: string;
  amount: number;
  pending?: boolean;
  merchantName?: string | null;
  category?: string[] | null;
  raw?: any;

  // App fields used by UI
  categoryHierarchy: { l0: string; l1: string; l2: string; l3: string };
  status: 'posted' | 'review' | 'error' | 'ready';
  reviewStatus: 'needs-review' | 'approved' | 'incorrect';
  confidence: number;
};

function normalizePlaidTx(args: {
  userId: string;
  bankAccountId: string;
  plaidAccountId: string;
  tx: any;
}): NormalizedTx {
  const { userId, bankAccountId, plaidAccountId, tx } = args;

  const description =
    tx.merchant_name ||
    tx.name ||
    tx.original_description ||
    'Unknown';

  // Plaid amount: positive usually means money OUT
  // Keep your existing convention (your UI already expects +/-)
  const amount = typeof tx.amount === 'number' ? -tx.amount : 0;

  return {
    id: tx.transaction_id,
    userId,
    bankAccountId,
    plaidTransactionId: tx.transaction_id,
    plaidAccountId,
    date: tx.date,
    description,
    amount,
    pending: tx.pending,
    merchantName: tx.merchant_name ?? null,
    category: tx.category ?? null,
    raw: tx,

    // default categorization placeholders (your AI flow will overwrite)
    categoryHierarchy: { l0: 'Uncategorized', l1: '', l2: '', l3: '' },
    status: 'posted',
    reviewStatus: 'needs-review',
    confidence: 0.5,
  };
}

async function saveTransactions(userId: string, bankAccountId: string, txs: NormalizedTx[]) {
  const firestore = db();
  const colPath = `users/${userId}/bankAccounts/${bankAccountId}/transactions`;
  const col = firestore.collection(colPath);

  // write in batches
  const chunkSize = 400;
  let saved = 0;

  for (let i = 0; i < txs.length; i += chunkSize) {
    const slice = txs.slice(i, i + chunkSize);
    const batch = firestore.batch();

    for (const t of slice) {
      const docRef = col.doc(t.plaidTransactionId);
      batch.set(docRef, t, { merge: true });
    }

    await batch.commit();
    saved += slice.length;
  }

  return saved;
}

// ---------- Route ----------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const userId: string | undefined = body.userId;
    const bankAccountId: string | undefined = body.bankAccountId;

    // Full rebuild options:
    // fullSync: true => delete + backfill using transactions/get from startDate
    // startDate: 'YYYY-MM-DD' (ex: 2025-01-01)
    const fullSync: boolean = !!body.fullSync;
    const startDate: string | undefined = body.startDate;

    if (!userId || !bankAccountId) {
      return NextResponse.json(
        { message: 'userId and bankAccountId are required' },
        { status: 400 }
      );
    }

    const firestore = db();
    const acctRef = firestore.doc(`users/${userId}/bankAccounts/${bankAccountId}`);
    const acctSnap = await acctRef.get();

    if (!acctSnap.exists) {
      return NextResponse.json({ message: 'Bank account not found' }, { status: 404 });
    }

    const acct = acctSnap.data() || {};

    // IMPORTANT: Use ONE canonical token. Support old schemas.
    const accessToken: string | undefined =
      acct.plaidAccessToken || acct.accessToken;

    const plaidAccountId: string | undefined =
      acct.plaidAccountId || acct.plaid_account_id;

    if (!accessToken) {
      return NextResponse.json({ message: 'accessToken is required' }, { status: 400 });
    }
    if (!plaidAccountId) {
      return NextResponse.json({ message: 'plaidAccountId is missing on this bankAccount doc' }, { status: 400 });
    }

    // If full rebuild requested, wipe existing tx first
    if (fullSync) {
      await deleteAllTransactionsForAccount(userId, bankAccountId);

      // Reset cursors so future sync starts clean
      await acctRef.set(
        {
          plaidCursor: null,
          plaidSyncCursor: null,
          lastSyncAt: new Date(),
        },
        { merge: true }
      );

      // Backfill with transactions/get from startDate -> today
      const start = startDate ? startDate : toYYYYMMDD(new Date(new Date().getFullYear() - 1, 0, 1));
      const end = toYYYYMMDD(new Date());

      let offset = 0;
      const count = 500;
      let fetched = 0;

      while (true) {
        const resp = await plaidClient.transactionsGet({
          access_token: accessToken,
          start_date: start,
          end_date: end,
          options: {
            account_ids: [plaidAccountId], // ✅ THIS prevents pulling all accounts
            count,
            offset,
          },
        });

        const txs = resp.data.transactions || [];
        if (txs.length === 0) break;

        // Normalize and save
        const normalized = txs.map((tx: any) =>
          normalizePlaidTx({ userId, bankAccountId, plaidAccountId, tx })
        );
        await saveTransactions(userId, bankAccountId, normalized);

        fetched += txs.length;
        offset += txs.length;

        const total = resp.data.total_transactions || 0;
        if (offset >= total) break;
      }

      // After backfill, run a transactions/sync once to store a good cursor for incremental
      const syncResp = await plaidClient.transactionsSync({
        access_token: accessToken,
        cursor: null,
        options: {
          account_ids: [plaidAccountId], // ✅ still filtered
        },
      });

      await acctRef.set(
        {
          plaidSyncCursor: syncResp.data.next_cursor,
          lastSyncedAt: new Date(),
          lastSyncAt: new Date(),
        },
        { merge: true }
      );

      return NextResponse.json({
        mode: 'fullSync',
        start_date: start,
        end_date: end,
        count: fetched,
        message: `Backfilled ${fetched} transactions for selected account only.`,
      });
    }

    // Normal incremental sync using transactions/sync cursor
    const cursor: string | null = acct.plaidSyncCursor || acct.plaidCursor || null;

    let hasMore = true;
    let nextCursor = cursor;
    let loops = 0;

    const addedAll: any[] = [];
    const modifiedAll: any[] = [];

    while (hasMore) {
      loops += 1;
      if (loops > 20) break; // safety cap

      const resp = await plaidClient.transactionsSync({
        access_token: accessToken,
        cursor: nextCursor,
        options: {
          account_ids: [plaidAccountId], // ✅ ONLY this account
        },
      });

      const { added, modified, removed, next_cursor, has_more } = resp.data;

      // Only keep txs that match this account (extra safety)
      const addedFiltered = (added || []).filter((t: any) => t.account_id === plaidAccountId);
      const modifiedFiltered = (modified || []).filter((t: any) => t.account_id === plaidAccountId);

      addedAll.push(...addedFiltered);
      modifiedAll.push(...modifiedFiltered);

      nextCursor = next_cursor;
      hasMore = !!has_more;
    }

    const normalizedToSave: NormalizedTx[] = [
      ...addedAll.map((tx: any) => normalizePlaidTx({ userId, bankAccountId, plaidAccountId, tx })),
      ...modifiedAll.map((tx: any) => normalizePlaidTx({ userId, bankAccountId, plaidAccountId, tx })),
    ];

    const saved = await saveTransactions(userId, bankAccountId, normalizedToSave);

    await acctRef.set(
      {
        plaidSyncCursor: nextCursor,
        lastSyncedAt: new Date(),
        lastSyncAt: new Date(),
      },
      { merge: true }
    );

    return NextResponse.json({
      mode: 'incremental',
      count: saved,
      added: addedAll.length,
      modified: modifiedAll.length,
      cursorUpdated: true,
    });
  } catch (e: any) {
    console.error('SYNC_TRANSACTIONS_ERROR', e?.response?.data || e?.message || e);
    return NextResponse.json(
      { message: e?.response?.data?.error_message || e?.message || 'Sync failed' },
      { status: 500 }
    );
  }
}
