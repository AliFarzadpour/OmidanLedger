
'use server';

import { PlaidApi, Configuration, PlaidEnvironments } from 'plaid';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

const db = getAdminDb();

function getPlaidClient(): PlaidApi {
  const { PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV } = process.env;
  if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
    console.warn('Plaid credentials missing, using dummy client for build. Real credentials required at runtime.');
    const dummyConfig = new Configuration({
      basePath: PlaidEnvironments.sandbox,
      baseOptions: { headers: { 'PLAID-CLIENT-ID': 'dummy', 'PLAID-SECRET': 'dummy' } },
    });
    return new PlaidApi(dummyConfig);
  }

  const plaidConfig = new Configuration({
    basePath: PlaidEnvironments[PLAID_ENV || 'sandbox'],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
        'PLAID-SECRET': PLAID_SECRET,
      },
    },
  });
  return new PlaidApi(plaidConfig);
}

/**
 * Fetches the latest balance for all of a user's Plaid-linked accounts
 * and stores it in a separate collection for quick UI display.
 * This does NOT affect any accounting ledgers.
 */
export async function getAndUpdatePlaidBalances(userId: string) {
  if (!userId) {
    throw new Error('User ID is required.');
  }

  const plaidClient = getPlaidClient();
  const batch = db.batch();

  // 1. Get all Plaid-linked bank accounts for the user
  const accountsQuery = await db
    .collection(`users/${userId}/bankAccounts`)
    .where('plaidAccessToken', '!=', null)
    .get();

  if (accountsQuery.empty) {
    return { success: true, count: 0, message: 'No Plaid-linked accounts found.' };
  }
  
  // Group access tokens to make one API call per financial institution
  const accessTokens = [...new Set(accountsQuery.docs.map(doc => doc.data().plaidAccessToken))];
  
  let updatedCount = 0;

  for (const token of accessTokens) {
    try {
      // 2. Fetch balances from Plaid
      const balanceResponse = await plaidClient.accountsBalanceGet({
        access_token: token,
      });

      // 3. Update Firestore with the new balances
      for (const account of balanceResponse.data.accounts) {
        const balanceData = {
          currentBalance: account.balances.current,
          availableBalance: account.balances.available,
          currency: account.balances.iso_currency_code,
          lastUpdatedAt: FieldValue.serverTimestamp(),
          source: 'plaid',
          plaidAccountId: account.account_id
        };

        const balanceDocRef = db.collection('users').doc(userId).collection('bankBalances').doc(account.account_id);
        batch.set(balanceDocRef, balanceData, { merge: true });
        updatedCount++;
      }
    } catch (error: any) {
        // If one token fails, log it and continue with others.
        console.error(`Failed to fetch balance for an access token: ${error.message}`);
    }
  }

  await batch.commit();

  return { success: true, count: updatedCount };
}
