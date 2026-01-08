// app/api/plaid/create-transfer-link-token/route.ts
import { NextResponse } from 'next/server';
import { PlaidApi, Configuration, PlaidEnvironments } from 'plaid';

// Function to initialize the Plaid client
function getPlaidClient() {
  const { PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV } = process.env;
  if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
    throw new Error('Plaid API credentials are not configured in .env file.');
  }

  const configuration = new Configuration({
    basePath: PlaidEnvironments[PLAID_ENV || 'sandbox'],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
        'PLAID-SECRET': PLAID_SECRET,
      },
    },
  });

  return new PlaidApi(configuration);
}

export async function POST(req: Request) {
  const { tenantId } = await req.json(); // Although not used by Plaid here, good for logging/scoping
  
  if (!tenantId) {
    return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });
  }

  const plaidClient = getPlaidClient();

  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: tenantId },
      client_name: 'Omidan Ledger',
      products: ['auth', 'transfer'], // 'auth' is recommended for transfers
      country_codes: ['US'],
      language: 'en',
      transfer: {
        intent_id: `rent-payment-${tenantId}-${Date.now()}` // Create a unique intent ID
      }
    });

    return NextResponse.json({ link_token: response.data.link_token });

  } catch (error: any) {
    console.error("Plaid Link Token Error:", error.response?.data || error);
    return NextResponse.json({ error: 'Failed to create link token' }, { status: 500 });
  }
}
