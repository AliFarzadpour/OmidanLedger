
'use server';

import { db } from '@/lib/admin-db';
import { revalidatePath } from 'next/cache';

export async function updateUserBillingConfig(userId: string, config: {
  baseFee: number;
  propertyRate: number;
  transactionFeePercent: number;
  subscriptionTier: string;
}) {
  
  try {
    await db.collection('users').doc(userId).update({
      'billing.baseFee': config.baseFee,
      'billing.propertyRate': config.propertyRate,
      'billing.transactionFeePercent': config.transactionFeePercent,
      'billing.subscriptionTier': config.subscriptionTier,
      'billing.updatedAt': new Date()
    });
    
    revalidatePath('/admin/users');
    return { success: true };
  } catch (error: any) {
    console.error("Failed to update billing:", error);
    throw new Error(error.message);
  }
}
