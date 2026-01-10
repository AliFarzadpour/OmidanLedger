// src/app/api/plaid/exchange-public-token/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

/**
 * Plaid Public Token Exchange API Route.
 *
 * This server-only endpoint securely exchanges a temporary public_token from Plaid Link
 * for a permanent access_token, which is required for making API calls on behalf of a user.
 *
 * Required Environment Variables for Firebase App Hosting:
 * - PLAID_CLIENT_ID: Your Plaid client ID.
 * - PLAID_SECRET: Your Plaid secret for the corresponding environment.
 * - PLAID_ENV: The Plaid environment ('sandbox', 'development', or 'production').
 */

// Helper to ensure environment variables are loaded
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const PLAID_ENV = (process.env.PLAID_ENV || 'sandbox') as 'sandbox' | 'development' | 'production';

// Initialize Plaid client with validated credentials
const plaidClient = new PlaidApi(
  new Configuration({
    basePath: PlaidEnvironments[PLAID_ENV],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': requireEnv('PLAID_CLIENT_ID'),
        'PLAID-SECRET': requireEnv('PLAID_SECRET'),
      },
    },
  })
);

export async function POST(req: NextRequest) {
  try {
    const { publicToken } = await req.json();

    if (!publicToken) {
      return NextResponse.json(
        { message: 'publicToken is required' },
        { status: 400 }
      );
    }

    const response = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const { access_token, item_id } = response.data;

    return NextResponse.json({ accessToken: access_token, itemId: item_id });
  } catch (error: any) {
    console.error(
      'PLAID_EXCHANGE_PUBLIC_TOKEN_ERROR:',
      error?.response?.data || error
    );
    const errorMessage =
      error.response?.data?.error_message ||
      error.message ||
      'Failed to exchange public token due to a server error.';
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
