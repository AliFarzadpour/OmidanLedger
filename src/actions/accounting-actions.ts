'use server';

import { getAdminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

const db = getAdminDb();

const workOrderCategoryToAccountingMap: Record<string, { l1: string, l2: string }> = {
    'Plumbing': { l1: 'Repairs', l2: 'Line 14: Repairs' },
    'HVAC': { l1: 'Repairs', l2: 'Line 14: Repairs' },
    'Electrical': { l1: 'Repairs', l2: 'Line 14: Repairs' },
    'Appliance': { l1: 'Repairs', l2: 'Line 14: Repairs' },
    'Turnover': { l1: 'Repairs', l2: 'Line 7: Cleaning and maintenance' },
    'Cleaning': { l1: 'Repairs', l2: 'Line 7: Cleaning and maintenance' },
    'Landscaping': { l1: 'Repairs', l2: 'Line 7: Cleaning and maintenance' },
    'Other': { l1: 'Property Operations', l2: 'Line 19: Other' },
};

export async function createExpenseFromWorkOrder(data: {
    userId: string;
    workOrderId: string;
    bankAccountId: string;
    propertyId: string;
    vendorId?: string;
    amount: number;
    date: string;
    description: string;
    category: { l0: string, l1: string, l2: string, l3: string };
}) {
    const { userId, workOrderId, bankAccountId, ...txData } = data;

    if (!userId || !workOrderId || !bankAccountId || !txData.amount) {
        throw new Error("Missing required fields to create an expense.");
    }
    
    const batch = db.batch();

    // 1. Create the new transaction record
    const txRef = db.collection('users').doc(userId).collection('bankAccounts').doc(bankAccountId).collection('transactions').doc();
    batch.set(txRef, {
        ...txData,
        amount: -Math.abs(txData.amount), // Ensure it's a negative value for an expense
        userId,
        bankAccountId,
        source: 'workOrder',
        sourceId: workOrderId,
        createdAt: FieldValue.serverTimestamp(),
    });

    // 2. Update the work order
    const woRef = db.collection('users').doc(userId).collection('opsWorkOrders').doc(workOrderId);
    batch.update(woRef, {
        actualCost: Math.abs(txData.amount),
        paid: true,
        status: 'Completed', // Optionally auto-complete the WO
        'accounting.expenseTransactionId': txRef.id,
        'accounting.expenseCreatedAt': FieldValue.serverTimestamp(),
        'accounting.expenseAmount': Math.abs(txData.amount),
    });

    try {
        await batch.commit();
        return { success: true, transactionId: txRef.id };
    } catch (error: any) {
        console.error("Failed to create expense from work order:", error);
        throw new Error(error.message || "An unknown error occurred.");
    }
}
