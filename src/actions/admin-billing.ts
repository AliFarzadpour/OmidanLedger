
'use server';

import { db } from '@/lib/admin-db';
import { revalidatePath } from 'next/cache';

// Updated interface to match the new form fields
export async function updateUserBillingConfig(userId: string, config: {
  minFee: number;
  unitCap: number;
  transactionFeePercent: number;
  subscriptionTier: string;
}) {
  
  try {
    // Update the user document with the new billing structure
    await db.collection('users').doc(userId).update({
      'billing.minFee': config.minFee,
      'billing.unitCap': config.unitCap,
      'billing.transactionFeePercent': config.transactionFeePercent,
      'billing.subscriptionTier': config.subscriptionTier,
      'billing.status': config.subscriptionTier !== 'free' ? 'active' : 'trialing',
      'billing.updatedAt': new Date()
    });
    
    // revalidatePath is server-side, it's better to reload on the client
    // revalidatePath('/admin/users'); 
    return { success: true };
  } catch (error: any) {
    console.error("Failed to update billing:", error);
    throw new Error(error.message);
  }
}
