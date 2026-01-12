
import { NextRequest, NextResponse } from 'next/server';
import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid';

const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID!,
      'PLAID-SECRET': process.env.PLAID_SECRET!,
    },
  },
});

const plaidClient = new PlaidApi(configuration);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, accessToken, daysRequested } = body;

    if (!userId) {
      return NextResponse.json({ message: 'User ID is required' }, { status: 400 });
    }

    const configs: any = {
      user: { client_user_id: userId },
      client_name: 'OmidanLedger',
      country_codes: [CountryCode.Us],
      language: 'en',
    };

    // Re-linking (Update Mode) logic
    if (accessToken) {
      configs.access_token = accessToken;
      // Products must be empty for Update Mode
      configs.products = [];
    } else {
      // New Connection logic
      configs.products = [Products.Transactions];
      // Set a long history. Plaid will provide up to 24 months or whatever the bank supports.
      const days = typeof daysRequested === 'number' ? daysRequested : 730; 
      configs.transactions = { days_requested: days };
    }

    const createTokenResponse = await plaidClient.linkTokenCreate(configs);
    return NextResponse.json({ link_token: createTokenResponse.data.link_token });
    
  } catch (error: any) {
    const errorData = error.response?.data || error.message;
    console.error('PLAID_API_ERROR:', errorData);
    
    return NextResponse.json(
      { message: errorData.error_message || 'Failed to create link token' }, 
      { status: 500 }
    );
  }
}
