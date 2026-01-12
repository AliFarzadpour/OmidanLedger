import { NextRequest, NextResponse } from "next/server";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import admin from "firebase-admin";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

// ---------- Firebase Admin init ----------
function initAdmin() {
  if (admin.apps.length) return admin.app();

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_KEY env var");

  const serviceAccount = JSON.parse(raw);

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// ---------- Plaid init ----------
const plaidClient = new PlaidApi(
  new Configuration({
    basePath: PlaidEnvironments[process.env.PLAID_ENV || "sandbox"],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID!,
        "PLAID-SECRET": process.env.PLAID_SECRET!,
      },
    },
  })
);

type SyncBody = {
  userId: string;
  bankAccountId: string; // your Firestore doc id under users/{uid}/bankAccounts/{bankAccountId}
  // optional: force rebuild from scratch for THIS account stream
  resetCursor?: boolean;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SyncBody;
    const { userId, bankAccountId, resetCursor } = body;

    if (!userId || !bankAccountId) {
      return NextResponse.json(
        { message: "userId and bankAccountId are required" },
        { status: 400 }
      );
    }

    initAdmin();
    const db = getFirestore();

    const bankRef = db.doc(`users/${userId}/bankAccounts/${bankAccountId}`);
    const bankSnap = await bankRef.get();

    if (!bankSnap.exists) {
      return NextResponse.json(
        { message: "Bank account doc not found" },
        { status: 404 }
      );
    }

    const bank = bankSnap.data() as any;

    // Accept either field name (you have both in your DB mess)
    const accessToken: string | undefined =
      bank.plaidAccessToken || bank.accessToken;

    const plaidAccountId: string | undefined = bank.plaidAccountId;

    if (!accessToken) {
      return NextResponse.json(
        { message: "accessToken is required (missing plaidAccessToken/accessToken)" },
        { status: 400 }
      );
    }
    if (!plaidAccountId) {
      return NextResponse.json(
        { message: "plaidAccountId is required on the bankAccounts doc" },
        { status: 400 }
      );
    }

    // IMPORTANT:
    // /transactions/sync uses "account_id" (singular) to limit results to ONE account.
    // Cursor is ALSO per account_id stream. Do NOT reuse a cursor from an unfiltered stream.
    let cursor: string | null = resetCursor ? null : (bank.plaidCursor ?? null);

    let added: any[] = [];
    let modified: any[] = [];
    let removed: any[] = [];
    let hasMore = true;

    // Pull all pages (Plaid default count is 100; max 500).
    while (hasMore) {
      const resp = await plaidClient.transactionsSync({
        access_token: accessToken,
        cursor: cursor ?? undefined,
        count: 500,
        options: {
          include_original_description: true,
        },
      });

      const data = resp.data;
      
      // Filter here since account_ids is not an option in transactionsSync
      added = added.concat((data.added || []).filter(t => t.account_id === plaidAccountId));
      modified = modified.concat((data.modified || []).filter(t => t.account_id === plaidAccountId));
      removed = removed.concat((data.removed || []).filter(t => t.account_id === plaidAccountId));

      hasMore = !!data.has_more;
      cursor = data.next_cursor;
    }

    const txCol = db.collection(
      `users/${userId}/bankAccounts/${bankAccountId}/transactions`
    );

    // Write in batches of 400 (Firestore limit safety)
    const upserts = [...added, ...modified];
    let written = 0;

    for (let i = 0; i < upserts.length; i += 400) {
      const chunk = upserts.slice(i, i + 400);
      const batch = db.batch();

      for (const t of chunk) {
        const txId = t.transaction_id; // Plaid stable id
        const txRef = txCol.doc(txId);

        // Minimal schema that your UI expects
        batch.set(
          txRef,
          {
            id: txId,
            plaidTransactionId: txId,
            userId,
            bankAccountId,
            accountId: plaidAccountId,

            date: t.date, // YYYY-MM-DD
            description: t.name || t.merchant_name || t.original_description || "",
            amount: typeof t.amount === "number" ? t.amount * -1 : 0, // Normalize amount

            // keep your UI from crashing
            categoryHierarchy: {
              l0: "Uncategorized",
              l1: "",
              l2: "",
              l3: "",
            },
            confidence: 0.5,
            status: "review",
            reviewStatus: "needs-review",

            // optional Plaid context
            merchantName: t.merchant_name ?? null,
            pending: t.pending ?? false,

            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }

      await batch.commit();
      written += chunk.length;
    }

    // Handle removed
    if (removed.length) {
      for (let i = 0; i < removed.length; i += 400) {
        const chunk = removed.slice(i, i + 400);
        const batch = db.batch();

        for (const r of chunk) {
          const txRef = txCol.doc(r.transaction_id);
          batch.delete(txRef);
        }

        await batch.commit();
      }
    }

    // Persist cursor ON THE BANK ACCOUNT DOC (per-account stream)
    await bankRef.set(
      {
        plaidCursor: cursor,
        lastSyncAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({
      count: (added?.length || 0),
      written,
      modified: (modified?.length || 0),
      removed: (removed?.length || 0),
    });
  } catch (err: any) {
    console.error("SYNC_TRANSACTIONS_ERROR:", err?.response?.data || err);
    return NextResponse.json(
      { message: err?.response?.data?.error_message || err.message || "Sync failed" },
      { status: 500 }
    );
  }
}
