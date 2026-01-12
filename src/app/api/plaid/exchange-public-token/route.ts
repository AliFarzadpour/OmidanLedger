
import { NextRequest, NextResponse } from 'next/server';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { db } from '@/lib/firebase-admin'; // Using your Admin SDK to bypass client restrictions
import { FieldValue } from 'firebase-admin/firestore';

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
      console.error('EXCHANGE_ERROR: Missing userId or publicToken');
      return NextResponse.json({ message: 'Missing required data' }, { status: 400 });
    }

    // 1. Exchange public token for access token and item ID
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });
    const { access_token, item_id } = exchangeResponse.data;

    // 2. Use the new access_token to get account details
    const accountsResponse = await plaidClient.accountsGet({
        access_token: access_token,
    });
    const accounts = accountsResponse.data.accounts;

    // --- Firestore Batch Write ---
    const batch = db.batch();

    // 3. Store the Plaid item and access token in a separate collection
    // This is good practice for managing linked items.
    const itemRef = db.collection('users').doc(userId).collection('plaidItems').doc(item_id);
    batch.set(itemRef, {
      id: item_id,
      userId: userId,
      accessToken: access_token,
      institutionId: accountsResponse.data.item.institution_id,
      lastUpdatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    // 4. Create or update each bank account using the Plaid account_id as the document ID
    accounts.forEach(account => {
        const accountRef = db.collection('users').doc(userId).collection('bankAccounts').doc(account.account_id);
        
        batch.set(accountRef, {
            id: account.account_id, // Ensure the ID is in the document
            userId: userId,
            plaidAccountId: account.account_id,
            plaidItemId: item_id,
            accountName: account.name,
            accountNumber: account.mask,
            accountType: (account.subtype === 'credit card' || account.type === 'credit')
              ? 'credit-card'
              : (account.subtype === 'savings' ? 'savings' : account.type),
            bankName: accountsResponse.data.item.institution_id, // Store institution ID
            linkStatus: 'connected',
            lastUpdatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
    });

    // 5. Commit all writes at once
    await batch.commit();

    return NextResponse.json({ success: true, accounts_created: accounts.length });
  } catch (error: any) {
    const plaidError = error.response?.data || error.message;
    console.error('PLAID_EXCHANGE_API_ERROR:', plaidError);
    return NextResponse.json(
      { message: plaidError.error_message || 'Bank link failed' }, 
      { status: 500 }
    );
  }
}
