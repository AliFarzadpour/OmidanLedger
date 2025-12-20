
import { NextResponse } from 'next/server';
import { Configuration, PlaidApi, PlaidEnvironments, TransferType, TransferNetwork } from 'plaid';
import { db } from '@/lib/admin-db';
import { FieldValue } from 'firebase-admin/firestore';

// Function to initialize the Plaid client
function getPlaidClient() {
  const { PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV } = process.env;
  if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
    throw new Error('Plaid API credentials are not configured in .env file.');
  }

  const configuration = new Configuration({
    basePath: PlaidEnvironments[PLAID_ENV || 'sandbox'],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
        'PLAID-SECRET': PLAID_SECRET,
      },
    },
  });

  return new PlaidApi(configuration);
}

export async function POST(req: Request) {
  const { public_token, amount, tenantId, accountId } = await req.json();
  
  if (!public_token || !amount || !tenantId || !accountId) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
  }

  const plaidClient = getPlaidClient();

  try {
    // 1. Fetch tenant's info for the transfer description
    const tenantDoc = await db.collection('users').doc(tenantId).get();
    if (!tenantDoc.exists) {
        throw new Error('Tenant not found');
    }
    const tenantData = tenantDoc.data()!;
    const tenantName = tenantData.email || `Tenant ${tenantId}`; // Fallback to email or ID
    const landlordId = tenantData.landlordId;
    const propertyId = tenantData.associatedPropertyId;

    if (!landlordId || !propertyId) {
        throw new Error('Tenant is not associated with a landlord or property.');
    }

    // 2. Exchange public_token for a long-lived access_token
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({ public_token });
    const accessToken = exchangeResponse.data.access_token;
    
    // 3. Create the ACH Transfer with Plaid
    const transferCreateResponse = await plaidClient.transferCreate({
      access_token: accessToken,
      account_id: accountId,
      type: 'debit' as TransferType, // Pulling money FROM the tenant's account
      network: 'ach' as TransferNetwork,
      amount: amount.toFixed(2), // Ensure amount is a string with two decimal places
      description: 'Rent Payment',
      user: { legal_name: tenantName },
    });

    const transferId = transferCreateResponse.data.transfer.id;
    const transferStatus = transferCreateResponse.data.transfer.status;

    // 4. Log the "Pending" transaction in a dedicated 'payments' collection for tracking
    await db.collection('users').doc(tenantId).collection('payments').add({
      transferId: transferId,
      amount: amount,
      status: transferStatus, // e.g., 'pending'
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      description: `Rent payment via Plaid`,
      // Store IDs needed for webhook processing
      landlordId: landlordId,
      propertyId: propertyId,
      tenantName: tenantName,
    });

    return NextResponse.json({ success: true, transferId: transferId });

  } catch (error: any) {
    console.error("Plaid Transfer Error:", error.response?.data || error);
    const errorMessage = error.response?.data?.error_message || "Transfer failed due to a server error.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
