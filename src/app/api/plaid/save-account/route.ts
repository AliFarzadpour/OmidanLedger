
import { NextRequest, NextResponse } from 'next/server';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import admin from 'firebase-admin';

function getAdminDb() {
  if (!getApps().length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!raw) throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_KEY');
    const serviceAccount = JSON.parse(raw);
    initializeApp({ credential: cert(serviceAccount) });
  }
  return getFirestore();
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

function mapAccountType(plaidType?: string, plaidSubtype?: string) {
  const t = (plaidType || '').toLowerCase();
  const st = (plaidSubtype || '').toLowerCase();

  if (t === 'depository') {
    if (st.includes('savings')) return 'savings';
    return 'checking';
  }
  if (t === 'credit') return 'credit-card';
  if (t === 'loan') return 'other';
  return 'other';
}

export async function POST(req: NextRequest) {
  try {
    const { userId, publicToken, metadata } = await req.json();

    if (!userId) return NextResponse.json({ message: 'userId is required' }, { status: 400 });
    if (!publicToken) return NextResponse.json({ message: 'publicToken is required' }, { status: 400 });

    const db = getAdminDb();

    // 1) Exchange public token -> access token + item id
    const exchange = await plaidClient.itemPublicTokenExchange({ public_token: publicToken });
    const accessToken = exchange.data.access_token;
    const itemId = exchange.data.item_id;

    const institutionName =
      metadata?.institution?.name ||
      metadata?.institution?.institution_id ||
      'Plaid';

    const accounts = metadata?.accounts || [];
    if (!accounts.length) {
      return NextResponse.json(
        { message: 'No accounts returned by Plaid metadata.' },
        { status: 400 }
      );
    }

    // 2) UPSERT each selected account doc using plaidAccountId as deterministic Firestore docId
    // This prevents duplicates forever.
    const results: Array<{ bankAccountId: string; accountName: string; mask?: string }> = [];

    for (const acct of accounts) {
      const plaidAccountId = acct.id; // Plaid account_id
      const docRef = db.doc(`users/${userId}/bankAccounts/${plaidAccountId}`);

      const accountType = mapAccountType(acct.type, acct.subtype);

      await docRef.set(
        {
          userId,
          accountName: acct.name || 'Account',
          bankName: institutionName,
          accountType,
          accountNumber: acct.mask || '',
          // store token in BOTH fields for compatibility
          plaidAccessToken: accessToken,
          accessToken: accessToken,
          plaidAccountId,
          plaidItemId: itemId,
          linkStatus: 'connected',
          historicalDataPending: false,
          lastUpdatedAt: new Date(),
        },
        { merge: true }
      );

      results.push({ bankAccountId: plaidAccountId, accountName: acct.name, mask: acct.mask });
    }

    return NextResponse.json({
      ok: true,
      access_token: accessToken,
      item_id: itemId,
      accountsSaved: results,
    });
  } catch (error: any) {
    console.error('SAVE_ACCOUNT_ERROR:', error?.response?.data || error?.message || error);
    const msg = error?.response?.data?.error_message || error?.message || 'Failed to save account';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
