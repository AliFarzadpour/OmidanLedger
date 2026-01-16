
import { NextRequest, NextResponse } from 'next/server';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { getAdminDb } from '@/lib/firebaseAdmin'; // Use the central admin instance

const db = getAdminDb();

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

export async function POST(req: NextRequest) {
  try {
    const { publicToken, userId, accountId } = await req.json();

    if (!userId) return NextResponse.json({ message: 'userId is required' }, { status: 400 });
    if (!publicToken) return NextResponse.json({ message: 'publicToken is required' }, { status: 400 });
    if (!accountId) return NextResponse.json({ message: 'accountId is required for relink' }, { status: 400 });

    const exchange = await plaidClient.itemPublicTokenExchange({ public_token: publicToken });
    const accessToken = exchange.data.access_token;
    const itemId = exchange.data.item_id;

    // IMPORTANT: Update ONLY the existing bankAccount doc.
    const docRef = db.doc(`users/${userId}/bankAccounts/${accountId}`);

    await docRef.set(
      {
        plaidAccessToken: accessToken,
        accessToken: accessToken, // keep both fields aligned
        plaidItemId: itemId,
        linkStatus: 'connected',
        lastUpdatedAt: new Date(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('EXCHANGE_TOKEN_ERROR:', error?.response?.data || error?.message || error);
    const msg = error?.response?.data?.error_message || error?.message || 'Failed to exchange token';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
