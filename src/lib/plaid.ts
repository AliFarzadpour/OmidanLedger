'use server';

import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

const plaidEnv = process.env.PLAID_ENV || 'sandbox';
const clientId = process.env.PLAID_CLIENT_ID || 'dummy_client_id';
const secret = process.env.PLAID_SECRET || 'dummy_secret';

const configuration = new Configuration({
  basePath: PlaidEnvironments[plaidEnv],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': clientId,
      'PLAID-SECRET': secret,
    },
  },
});

const plaidClient = new PlaidApi(configuration);

export async function exchangePublicToken(publicToken: string) {
  try {
    const response = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });
    return response.data.access_token;
  } catch (error) {
    console.error('Error exchanging public token:', error);
    throw new Error('Failed to exchange token');
  }
}

export async function createBankAccountFromPlaid(accessToken: string, accountId: string, name: string) {
    console.log('Creating bank account stub for:', name);
    return { success: true, id: 'bank_stub_' + Math.random().toString(36).substr(2, 9) };
}

export async function syncAndCategorizePlaidTransactions() {
    console.log('Syncing transactions stub...');
    return { success: true, count: 0 };
}

export async function fetchUserContext(userId: string) {
  console.log('Fetching user context stub for:', userId);
  return { recentTransactions: [], preferences: {} };
}

export async function getCategoryFromDatabase(description: string) {
  console.log('Getting category stub for:', description);
  return null;
}

export async function categorizeWithHeuristics(transaction: any) {
  console.log('Categorizing stub');
  return { category: 'Uncategorized', confidence: 0 };
}

export async function createLinkToken(userId: string) {
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: userId },
      client_name: 'Omidan Ledger',
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en',
    });
    return response.data.link_token;
  } catch (error) {
    console.error('Error creating link token:', error);
    throw new Error('Failed to create link token');
  }
}
