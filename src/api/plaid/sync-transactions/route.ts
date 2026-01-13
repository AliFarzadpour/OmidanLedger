
import { NextRequest, NextResponse } from 'next/server';
import { Configuration, PlaidApi, PlaidEnvironments, RemovedTransaction, Transaction as PlaidTransaction } from 'plaid';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { fetchUserContext, categorizeWithHeuristics } from '@/lib/plaid';
import { normalizeCategoryHierarchy, removeUndefinedDeep } from "@/lib/firestore-sanitize";

// ---------- Firebase Admin init ----------
function initAdmin() {
  if (admin.apps.length) return admin.app();

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_KEY env var');

  const serviceAccount = JSON.parse(raw);

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// ---------- Plaid init ----------
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
    const { userId, bankAccountId, fullSync, startDate } = await req.json();

    if (!userId || !bankAccountId) {
      return NextResponse.json(
        { message: 'userId and bankAccountId are required' },
        { status: 400 }
      );
    }

    initAdmin();
    const db = getFirestore();
    
    // Fetch the user's categorization context (rules, vendors, etc.)
    const userContext = await fetchUserContext(db, userId);

    const acctRef = db.doc(`users/${userId}/bankAccounts/${bankAccountId}`);
    const acctSnap = await acctRef.get();
    if (!acctSnap.exists) {
      return NextResponse.json(
        { message: 'Bank account not found' },
        { status: 404 }
      );
    }

    const acct = acctSnap.data() as any;
    const accessToken = acct.plaidAccessToken || acct.accessToken;
    const plaidAccountId = acct.plaidAccountId || bankAccountId;

    if (!accessToken) {
      return NextResponse.json(
        { message: 'accessToken is required' },
        { status: 400 }
      );
    }

    const txCol = db.collection(
      `users/${userId}/bankAccounts/${bankAccountId}/transactions`
    );
    let savedCount = 0;

    // ✅ FULL REBUILD MODE - This logic is now corrected.
    if (fullSync && startDate) {
      const start = /^\d{4}-\d{2}-\d{2}$/.test(startDate)
        ? startDate
        : `${new Date().getFullYear()}-01-01`;
      const end = toISODate(new Date());
      let offset = 0;
      const count = 500;
      let hasMore = true;

      while (hasMore) {
        const resp = await plaidClient.transactionsGet({
          access_token: accessToken,
          start_date: start,
          end_date: end,
          options: {
            account_ids: [plaidAccountId],
            count,
            offset,
          },
        });

        const txs = resp.data.transactions || [];
        if (txs.length === 0) {
            hasMore = false;
            continue;
        }
        
        const batch = db.batch();
        for (const t of txs) {
          const docId = t.transaction_id;
          const txRef = txCol.doc(docId);
          
          const categoryResult = await categorizeWithHeuristics(t.name, normalizeAmount(t.amount), t.personal_finance_category, userContext);
          
          const categoryHierarchy = normalizeCategoryHierarchy({
            l0: categoryResult.primaryCategory,
            l1: categoryResult.secondaryCategory,
            l2: categoryResult.subcategory,
            l3: categoryResult.details || '',
          });

          const updateData = removeUndefinedDeep({
              id: docId,
              plaidTransactionId: docId,
              userId,
              bankAccountId,
              accountId: plaidAccountId,
              date: t.date,
              description: t.merchant_name || t.name || t.original_description || '',
              amount: normalizeAmount(t.amount),
              categoryHierarchy,
              costCenter: categoryResult.costCenter, // Apply cost center from rule
              confidence: categoryResult.confidence,
              reviewStatus: (categoryResult.confidence || 0) < 0.95 ? 'needs-review' : 'approved',
              aiExplanation: categoryResult.explanation,
              merchantName: t.merchant_name ?? null,
              pending: t.pending ?? false,
              lastUpdatedAt: new Date(),
          });
          
          batch.set(txRef, updateData, { merge: true });
        }
        await batch.commit();
        savedCount += txs.length;

        offset += txs.length;
        if (offset >= (resp.data.total_transactions || 0)) {
            hasMore = false;
        }
      }
      
      await acctRef.set(
        { lastSyncAt: new Date(), lastSyncedAt: new Date(), plaidSyncCursor: null },
        { merge: true }
      );

      return NextResponse.json({ ok: true, mode: 'backfill', count: savedCount, start_date: start });
    }

    // ✅ INCREMENTAL SYNC MODE
    let cursor: string | null = acct.plaidSyncCursor ?? null;
    let added: PlaidTransaction[] = [];
    let modified: PlaidTransaction[] = [];
    let removed: RemovedTransaction[] = [];
    let hasMore = true;

    while (hasMore) {
      const resp = await plaidClient.transactionsSync({
        access_token: accessToken,
        cursor: cursor || undefined,
        count: 500,
        options: {
            include_personal_finance_category: true,
        }
      });

      const data = resp.data;
      cursor = data.next_cursor;
      hasMore = !!data.has_more;

      added = added.concat(data.added.filter(tx => tx.account_id === plaidAccountId));
      modified = modified.concat(data.modified.filter(tx => tx.account_id === plaidAccountId));
      removed = removed.concat(data.removed.filter(r => r.account_id === plaidAccountId));
    }
    
    const upserts = [...added, ...modified];
    
    if (upserts.length > 0) {
      const batch = db.batch();
      for (const t of upserts) {
        const docId = t.transaction_id;
        const txRef = txCol.doc(docId);
        
        const categoryResult = await categorizeWithHeuristics(t.name, normalizeAmount(t.amount), t.personal_finance_category, userContext);
        
        const categoryHierarchy = normalizeCategoryHierarchy({
          l0: categoryResult.primaryCategory,
          l1: categoryResult.secondaryCategory,
          l2: categoryResult.subcategory,
          l3: categoryResult.details || '',
        });

        const updateData = removeUndefinedDeep({
            id: docId,
            plaidTransactionId: docId,
            userId,
            bankAccountId,
            accountId: plaidAccountId,
            date: t.date,
            description: t.merchant_name || t.name || t.original_description || "",
            amount: normalizeAmount(t.amount),
            categoryHierarchy,
            costCenter: categoryResult.costCenter, // Apply cost center from rule
            confidence: categoryResult.confidence,
            reviewStatus: (categoryResult.confidence || 0) < 0.95 ? 'needs-review' : 'approved',
            aiExplanation: categoryResult.explanation,
            merchantName: t.merchant_name ?? null,
            pending: t.pending ?? false,
            lastUpdatedAt: new Date(),
        });

        batch.set(txRef, updateData, { merge: true });
      }
      await batch.commit();
      savedCount += upserts.length;
    }

      if (removed.length > 0) {
        const batch = db.batch();
        removed.forEach(r => batch.delete(txCol.doc(r.transaction_id)));
        await batch.commit();
    }

    await acctRef.set(
      { plaidSyncCursor: cursor, lastSyncAt: new Date(), lastSyncedAt: new Date() },
      { merge: true }
    );

    return NextResponse.json({ ok: true, mode: 'incremental', count: savedCount });
  } catch (err: any) {
    console.error('SYNC_TRANSACTIONS_ERROR:', err?.response?.data || err);
    const msg = err?.response?.data?.error_message || err.message || 'Sync failed';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
