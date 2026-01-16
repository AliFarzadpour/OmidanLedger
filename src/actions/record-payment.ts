
'use server';

import { getAdminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { incrementPropertyStats } from './update-property-stats';

const db = getAdminDb();

export async function recordManualPayment({
  tenantId,
  propertyId,
  unitId,
  landlordId,
  amount,
  method,
  date
}: {
  tenantId: string;
  propertyId: string;
  unitId?: string;
  landlordId: string;
  amount: number;
  method: string;
  date: string;
}) {
  const batch = db.batch();

  try {
    // Find a destination bank account for the landlord
    const landlordAccountsSnap = await db.collection('users').doc(landlordId)
        .collection('bankAccounts').where('accountType', '==', 'checking').limit(1).get();
        
    let destinationAccountId = 'manual-entries'; // Fallback virtual account
    if (!landlordAccountsSnap.empty) {
        destinationAccountId = landlordAccountsSnap.docs[0].id;
    }

    // 1. Create the Transaction record
    const txRef = db.collection('users').doc(landlordId)
      .collection('bankAccounts').doc(destinationAccountId)
      .collection('transactions').doc();

    const txData: any = {
        amount: amount,
        description: `Rent payment via ${method}`,
        date: date,
        categoryHierarchy: {
            l0: 'INCOME',
            l1: 'Rental Income',
            l2: 'Line 3: Rents Received'
        },
        status: 'posted',
        propertyId: propertyId,
        tenantId: tenantId, 
        userId: landlordId,
        bankAccountId: destinationAccountId,
        createdAt: FieldValue.serverTimestamp(),
        costCenter: unitId || propertyId
    };

    if (unitId) {
        txData.unitId = unitId;
    }

    batch.set(txRef, txData);


    // 2. Deduct from Tenant Balance
    const tenantRef = db.collection('users').doc(tenantId);
    batch.update(tenantRef, {
      'billing.balance': FieldValue.increment(-amount),
      'billing.lastPaymentDate': date
    });

    await batch.commit();

    // 3. Update the Revenue Center Stats (run after batch)
    await incrementPropertyStats({
      propertyId,
      date: new Date(date),
      amount: amount,
      userId: landlordId
    });

    return { success: true };
  } catch (error: any) {
    console.error("Recording error:", error);
    throw new Error(error.message);
  }
}
