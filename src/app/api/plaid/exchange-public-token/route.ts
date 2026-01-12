
import { NextRequest, NextResponse } from 'next/server';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { db } from '@/lib/firebase-admin';

const PLAID_ENV = (process.env.PLAID_ENV || 'sandbox') as 'sandbox' | 'development' | 'production';

const plaidClient = new PlaidApi(
  new Configuration({
    basePath: PlaidEnvironments[PLAID_ENV],
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
    const { publicToken, userId } = await req.json();

    if (!publicToken || !userId) {
      return NextResponse.json({ message: 'Missing required data' }, { status: 400 });
    }

    // 1) Exchange public_token -> access_token
    const exchange = await plaidClient.itemPublicTokenExchange({ public_token: publicToken });
    const { access_token, item_id } = exchange.data;

    // 2) Save token at ITEM level (single source of truth)
    const itemRef = db.collection('users').doc(userId).collection('plaidItems').doc(item_id);
    await itemRef.set(
      {
        plaidItemId: item_id,
        accessToken: access_token,
        plaidAccessToken: access_token, // keep legacy
        plaidCursor: null,
        linkStatus: 'connected',
        lastUpdatedAt: new Date(),
      },
      { merge: true }
    );

    // 3) Fetch ALL accounts for this item and upsert into bankAccounts
    const accountsResp = await plaidClient.accountsGet({ access_token });
    const accounts = accountsResp.data.accounts;

    const batch = db.batch();

    for (const acct of accounts) {
      // Use plaidAccountId as the unique key to prevent duplicates
      const bankAccountId = acct.account_id;
      const bankRef = db.collection('users').doc(userId).collection('bankAccounts').doc(bankAccountId);

      batch.set(
        bankRef,
        {
          userId,
          bankName: accountsResp.data.item?.institution_id ? 'Plaid' : 'Plaid',
          accountName: acct.name || acct.official_name || 'Bank Account',
          accountNumber: acct.mask || '',
          accountType: acct.type === 'credit' ? 'credit-card' : (acct.subtype === 'savings' ? 'savings' : 'checking'),

          // keys for routing + joining
          plaidItemId: item_id,
          plaidAccountId: acct.account_id,

          // token fields OPTIONAL here (we can store them, or rely on item doc)
          // Storing them makes your current sync route work immediately
          accessToken: access_token,
          plaidAccessToken: access_token,

          linkStatus: 'connected',
          lastUpdatedAt: new Date(),
        },
        { merge: true }
      );
    }

    await batch.commit();

    return NextResponse.json({
      success: true,
      itemId: item_id,
      accountsUpserted: accounts.length,
    });
  } catch (error: any) {
    const plaidError = error.response?.data || error.message;
    console.error('PLAID_EXCHANGE_API_ERROR:', plaidError);
    return NextResponse.json(
      { message: plaidError.error_message || 'Bank link failed' },
      { status: 500 }
    );
  }
}
