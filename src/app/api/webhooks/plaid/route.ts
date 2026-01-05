
// app/api/webhooks/plaid/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/admin-db';
import { FieldValue } from 'firebase-admin/firestore';
import { syncAndCategorizePlaidTransactions } from '@/lib/plaid';
import { incrementPropertyStats } from '@/actions/update-property-stats';

export async function POST(req: Request) {
  const body = await req.json();
  const { webhook_type, webhook_code, item_id, transfer_id } = body;

  console.log(`Received Plaid Webhook: ${webhook_type} | ${webhook_code}`);

  try {
    // --- Handler for TRANSACTION Sync Updates ---
    if (webhook_type === 'TRANSACTIONS') {
      if (
        webhook_code === 'HISTORICAL_UPDATE' ||
        webhook_code === 'SYNC_UPDATES_AVAILABLE' ||
        webhook_code === 'DEFAULT_UPDATE'
      ) {
        // Find the User & Account associated with this Plaid Item ID
        const accountsSnapshot = await db.collectionGroup('bankAccounts').where('plaidItemId', '==', item_id).get();
        if (accountsSnapshot.empty) {
          console.log(`[Webhook] No account found for item_id: ${item_id}`);
          return NextResponse.json({ received: true, message: 'No account found' });
        }
        
        // There's usually only one user per item, so we check the first one.
        const firstAccount = accountsSnapshot.docs[0].data();
        const userId = firstAccount.userId;

        if (!userId) {
          console.error(`[Webhook] Critical: No userId found on account for item_id: ${item_id}`);
          return NextResponse.json({ received: true, message: 'User ID missing from account data.' });
        }


        // NEW: Check if user has auto-sync enabled
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        // Default to true if the setting doesn't exist
        const autoSyncEnabled = userData?.plaidAutoSyncEnabled !== false; 

        if (!autoSyncEnabled) {
            console.log(`[Webhook] Auto-sync disabled for user ${userId}. Skipping sync for item_id: ${item_id}`);
            return NextResponse.json({ received: true, message: 'Auto-sync disabled by user.' });
        }

        // Trigger Sync for each account found under this Item
        const syncPromises = accountsSnapshot.docs.map(async (doc) => {
          const data = doc.data();
          console.log(`[Webhook] Auto-syncing account: ${doc.id} for user ${data.userId}`);
          return syncAndCategorizePlaidTransactions({ userId: data.userId, bankAccountId: doc.id });
        });
        await Promise.all(syncPromises);
        console.log(`[Webhook] Auto-sync complete for item_id: ${item_id}`);
      }
    }

    // --- Handler for TRANSFER Status Updates (e.g., Rent Payments) ---
    if (webhook_type === 'TRANSFER' && transfer_id) {
      if (webhook_code === 'swept' || webhook_code === 'settled') { // 'swept' is often used as the final confirmation
        
        // 1. Find the pending payment record in Firestore
        const paymentQuery = await db.collectionGroup('payments').where('transferId', '==', transfer_id).limit(1).get();
        if (paymentQuery.empty) {
          console.warn(`[Webhook] Payment record not found for transfer_id: ${transfer_id}`);
          return NextResponse.json({ received: true, message: 'Payment not found' });
        }

        const paymentDoc = paymentQuery.docs[0];
        const { amount, tenantId, propertyId, landlordId, tenantName } = paymentDoc.data();

        // 2. Start a batch write to ensure atomicity
        const batch = db.batch();

        // 3. Mark payment as 'succeeded'
        batch.update(paymentDoc.ref, {
          status: 'succeeded',
          settledAt: FieldValue.serverTimestamp(),
        });

        // 4. Create a Transaction record for the Landlord for bookkeeping
        // Find a suitable bank account for the landlord to deposit into.
        // For simplicity, we find the first available checking account.
        const landlordAccountsSnap = await db.collection('users').doc(landlordId)
          .collection('bankAccounts').where('accountType', '==', 'checking').limit(1).get();
          
        if (landlordAccountsSnap.empty) {
            console.error(`[Webhook] Critical: No destination checking account found for landlord ${landlordId}.`);
            // Still update payment status, but skip transaction creation
        } else {
            const landlordBankAccountId = landlordAccountsSnap.docs[0].id;
            const txRef = db.collection('users').doc(landlordId)
              .collection('bankAccounts').doc(landlordBankAccountId)
              .collection('transactions').doc();
            
            batch.set(txRef, {
              amount: amount, // Positive amount for income
              description: `Rent from ${tenantName || `Tenant ${tenantId}`} via Plaid`,
              date: new Date().toISOString().split('T')[0],
              primaryCategory: "Income",
              secondaryCategory: "Rental Income",
              subcategory: "Residential Rent",
              status: 'posted',
              propertyId: propertyId,
              userId: landlordId,
              tenantId: tenantId, // <<< The critical link for tenant history
              bankAccountId: landlordBankAccountId,
              createdAt: FieldValue.serverTimestamp()
            });
        }
        
        await batch.commit();
        console.log(`[Webhook] Successfully processed transfer for ${amount} from tenant ${tenantId}`);

        // 5. Update Financial Stats (this is an async server action, can run after batch)
        if (propertyId && landlordId) {
          await incrementPropertyStats({
            propertyId,
            date: new Date(),
            amount: amount,
            userId: landlordId
          });
          console.log(`[Webhook] Incremented stats for property ${propertyId}`);
        }
      }
    }

    return NextResponse.json({ received: true });

  } catch (error: any) {
    console.error('Plaid Webhook Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
