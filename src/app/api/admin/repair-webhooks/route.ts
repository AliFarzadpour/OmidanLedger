'use server';

import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { plaidClient } from '@/lib/plaid-client';
import { PlaidApi, PlaidEnvironments } from 'plaid';

export async function POST() {
  const db = getAdminDb();
  const webhookUrl = 'https://omidanledger.com/api/webhooks/plaid';

  try {
    const bankAccountsSnap = await db.collectionGroup('bankAccounts').where('plaidAccessToken', '!=', null).get();

    if (bankAccountsSnap.empty) {
      return NextResponse.json({ message: 'No Plaid-linked accounts found to update.' });
    }

    const processedTokens = new Set<string>();
    const accessTokens = bankAccountsSnap.docs.map(doc => doc.data().plaidAccessToken).filter(Boolean);
    
    accessTokens.forEach(token => processedTokens.add(token));

    let successCount = 0;
    let errorCount = 0;
    const errors: { tokenSnippet: string; error: string }[] = [];

    console.log(`[Repair Webhooks] Found ${processedTokens.size} unique access tokens to update.`);

    for (const token of processedTokens) {
      try {
        await plaidClient.itemWebhookUpdate({
          access_token: token,
          webhook: webhookUrl,
        });
        successCount++;
        console.log(`[Repair Webhooks] Successfully updated webhook for token ending in ...${token.slice(-4)}`);
      } catch (error: any) {
        errorCount++;
        const errorMessage = error.response?.data?.error_message || error.message || 'Unknown error';
        console.error(`[Repair Webhooks] Failed to update webhook for token ending in ...${token.slice(-4)}:`, errorMessage);
        errors.push({
          tokenSnippet: `...${token.slice(-4)}`,
          error: errorMessage,
        });
      }
    }

    const summary = {
      message: 'Webhook repair process completed.',
      totalTokensProcessed: processedTokens.size,
      successfulUpdates: successCount,
      failedUpdates: errorCount,
      errors: errors,
    };
    
    console.log('[Repair Webhooks] Summary:', summary);
    return NextResponse.json(summary);

  } catch (error: any) {
    console.error('[Repair Webhooks] Critical error during function execution:', error);
    return NextResponse.json({ message: 'An unexpected server error occurred.', error: error.message }, { status: 500 });
  }
}
