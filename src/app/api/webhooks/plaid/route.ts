// app/api/webhooks/plaid/route.ts
import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { getApps, initializeApp } from 'firebase-admin/app';
import { syncAndCategorizePlaidTransactions } from '@/lib/plaid'; // Import your Sync Flow

// Init Admin DB for Webhook
function getAdminDB() {
  if (!getApps().length) initializeApp();
  return getFirestore();
}

export async function POST(req: Request) {
  const body = await req.json();
  const { webhook_type, webhook_code, item_id } = body;

  console.log(`Received Plaid Webhook: ${webhook_type} | ${webhook_code}`);

  // We only care about HISTORICAL_UPDATE or SYNC_UPDATES_AVAILABLE
  if (webhook_type === 'TRANSACTIONS') {
    if (webhook_code === 'HISTORICAL_UPDATE' || 
        webhook_code === 'SYNC_UPDATES_AVAILABLE' || 
        webhook_code === 'DEFAULT_UPDATE') {
      
      try {
        const db = getAdminDB();
        
        // 1. Find the User & Account associated with this Plaid Item ID
        // Note: You need to create an index for 'plaidItemId' in Firestore if you haven't yet.
        const accountsSnapshot = await db.collectionGroup('bankAccounts')
          .where('plaidItemId', '==', item_id)
          .get();

        if (accountsSnapshot.empty) {
          console.log('No matching account found for this Item ID');
          return NextResponse.json({ received: true });
        }

        // 2. Trigger Sync for each account found under this Item
        const syncPromises = accountsSnapshot.docs.map(async (doc) => {
          const data = doc.data();
          // Call your existing Genkit Flow
          console.log(`Auto-syncing account: ${doc.id} for user ${data.userId}`);
          return syncAndCategorizePlaidTransactions({
            userId: data.userId,
            bankAccountId: doc.id
          });
        });

        await Promise.all(syncPromises);
        console.log('Auto-sync complete');

      } catch (error) {
        console.error('Webhook Error:', error);
        // Return 200 anyway so Plaid stops retrying (unless you want it to retry)
        return NextResponse.json({ received: true, error: 'Internal Error' }, { status: 200 });
      }
    }
  }

  return NextResponse.json({ received: true });
}
