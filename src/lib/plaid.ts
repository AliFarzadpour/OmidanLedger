import { PlaidLinkOnSuccessMetadata } from 'react-plaid-link';

/**
 * Syncs and categorizes transactions for a specific bank account.
 * This calls your /api/plaid/sync-transactions endpoint.
 */
export async function syncAndCategorizePlaidTransactions({ 
  userId, 
  bankAccountId 
}: { 
  userId: string; 
  bankAccountId: string; 
}) {
  const response = await fetch('/api/plaid/sync-transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, bankAccountId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to sync transactions');
  }

  return await response.json();
}

/**
 * Creates a Plaid Link Token.
 * Supports both NEW connections and UPDATE mode (Re-linking) if an accessToken is provided.
 */
export async function createLinkToken({ 
  userId, 
  accessToken, 
  daysRequested 
}: { 
  userId: string; 
  accessToken?: string; 
  daysRequested?: number; 
}) {
  const response = await fetch('/api/plaid/create-link-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      userId, 
      accessToken, // Sent to backend to trigger Update Mode if present
      daysRequested 
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create link token');
  }

  const data = await response.json();
  
  // Returns the string token directly for usePlaidLink
  return data.link_token;
}

/**
 * Exchanges a public_token for a permanent access_token.
 */
export async function exchangePublicToken({ publicToken }: { publicToken: string }) {
  const response = await fetch('/api/plaid/exchange-public-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ publicToken }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to exchange token');
  }
  
  return await response.json();
}

/**
 * Saves bank account details and initial metadata to Firestore.
 */
export async function createBankAccountFromPlaid({
  userId,
  accessToken,
  metadata,
}: {
  userId: string;
  accessToken: string;
  metadata: PlaidLinkOnSuccessMetadata;
}) {
  const response = await fetch('/api/plaid/save-account', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, accessToken, metadata }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to save account to database');
  }
  
  return await response.json();
}