import { NextRequest, NextResponse } from 'next/server';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { db } from '@/lib/firebase-admin'; // Using your Admin SDK to bypass client restrictions

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

// ... (imports and configuration remain the same)

export async function POST(req: NextRequest) {
  try {
    const { publicToken, userId, accountId } = await req.json();

    if (!publicToken || !userId) {
      console.error('EXCHANGE_ERROR: Missing userId or publicToken');
      return NextResponse.json({ message: 'Missing required data' }, { status: 400 });
    }

    const response = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const { access_token, item_id } = response.data;

    if (accountId) {
      await db
        .collection('users')
        .doc(userId)
        .collection('bankAccounts')
        .doc(accountId)
        .set({
          // CHANGED: Use 'accessToken' to match what your sync logic is looking for
          accessToken: access_token, 
          plaidItemId: item_id,
          linkStatus: 'connected',
          lastUpdatedAt: new Date(),
        }, { merge: true });
        
      console.log(`Successfully updated account ${accountId} for user ${userId}`);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    const plaidError = error.response?.data || error.message;
    console.error('PLAID_EXCHANGE_API_ERROR:', plaidError);
    return NextResponse.json(
      { message: plaidError.error_message || 'Bank link failed' }, 
      { status: 500 }
    );
  }
}