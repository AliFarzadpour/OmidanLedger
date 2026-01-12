
import { PlaidLinkOnSuccessMetadata } from 'react-plaid-link';

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
      accessToken, 
      daysRequested 
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create link token');
  }

  const data = await response.json();
  return data.link_token;
}

/**
 * FIXED: Exchanges a public_token for a permanent access_token.
 * Now correctly typed to accept userId and accountId for database updates.
 */
export async function exchangePublicToken({ 
  publicToken,
  userId,
  accountId
}: { 
  publicToken: string;
  userId: string;
  accountId?: string;
}) {
  const response = await fetch('/api/plaid/exchange-public-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ publicToken, userId, accountId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to exchange token');
  }
  
  return await response.json();
}

/**
 * Saves bank account details to Firestore via backend.
 * IMPORTANT: This sends a *publicToken* (NOT accessToken).
 */
export async function createBankAccountFromPlaid({
  userId,
  publicToken,
  metadata,
}: {
  userId: string;
  publicToken: string;
  metadata: PlaidLinkOnSuccessMetadata;
}) {
  const response = await fetch('/api/plaid/save-account', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, publicToken, metadata }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to save account to database');
  }

  return await response.json();
}

/**
 * Syncs transactions for a specific bank account.
 * Optional: pass startDate for backfill (YYYY-MM-DD).
 */
export async function syncAndCategorizePlaidTransactions({
  userId,
  bankAccountId,
  fullSync,
  startDate,
}: {
  userId: string;
  bankAccountId: string;
  fullSync?: boolean;
  startDate?: string;
}) {
  const response = await fetch('/api/plaid/sync-transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, bankAccountId, fullSync, startDate }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to sync transactions');
  }

  return await response.json();
}
// Add these to the bottom of src/lib/plaid.ts

/**
 * Placeholder to satisfy AI repair flow imports
 */
export async function fetchUserContext(userId: string) {
  return { userId };
}

/**
 * Placeholder to satisfy AI repair flow imports
 */
export async function getCategoryFromDatabase(description: string) {
  return 'Uncategorized';
}

/**
 * Placeholder to satisfy AI repair flow imports
 */
export async function categorizeWithHeuristics(description: string) {
  return ['Uncategorized'];
}
