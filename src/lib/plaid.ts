import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

// Use safe defaults so the build doesn't crash if keys are missing
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

export const plaidClient = new PlaidApi(configuration);
