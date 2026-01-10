// src/app/api/plaid/create-link-token/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
} from 'plaid';

/**
 * Plaid Link Token Creation API Route.
 *
 * This server-only endpoint creates a Plaid Link token for initializing the Plaid Link flow
 * on the client. It validates that all required server-side environment variables are present.
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
    const body = await req.json();
    const { userId, accessToken, daysRequested } = body;

    if (!userId) {
      return NextResponse.json(
        { message: 'User ID is required' },
        { status: 400 }
      );
    }

    const configs: any = {
      user: { client_user_id: userId },
      client_name: 'FiscalFlow',
      country_codes: [CountryCode.Us],
      language: 'en',
    };

    if (accessToken) {
      // Re-link (Update Mode) logic
      configs.access_token = accessToken;
    } else {
      // New connection logic
      configs.products = [Products.Transactions];
      if (daysRequested) {
        configs.transactions = { days_requested: daysRequested };
      }
    }

    const createTokenResponse = await plaidClient.linkTokenCreate(configs);
    return NextResponse.json({
      link_token: createTokenResponse.data.link_token,
    });
  } catch (error: any) {
    // Improved error logging for easier debugging
    console.error(
      'PLAID_CREATE_LINK_TOKEN_ERROR:',
      error?.response?.data || error
    );

    const errorMessage =
      error.response?.data?.error_message ||
      error.message ||
      'Failed to create Plaid link token due to a server error.';

    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
