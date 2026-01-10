'use server';

import { createTenantInvoice } from './stripe-actions';

interface TenantInvoiceData {
  landlordAccountId: string;
  tenantEmail: string;
  tenantPhone?: string;
  amount: number;
  description: string;
}

/**
 * Creates and sends Stripe invoices to multiple tenants in a batch.
 *
 * @param invoices - An array of invoice data objects.
 * @returns An object with the count of successful and failed invoices.
 */
export async function batchCreateTenantInvoices(invoices: TenantInvoiceData[]) {
  if (!invoices || invoices.length === 0) {
    return { success: 0, failed: 0, message: 'No invoices to send.' };
  }

  const results = await Promise.allSettled(
    // @ts-ignore
    invoices.map(invoiceData => createTenantInvoice(invoiceData))
  );

  const successCount = results.filter(r => r.status === 'fulfilled').length;
  const failedCount = results.length - successCount;

  results.forEach(result => {
    if (result.status === 'rejected') {
      console.error('Batch Invoice Error:', result.reason);
    }
  });

  return {
    success: successCount,
    failed: failedCount,
  };
}
