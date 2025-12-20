'use server';

import { db } from '@/lib/admin-db';
import { FieldValue } from 'firebase-admin/firestore';

export async function inviteTenant({
  email,
  propertyId,
  landlordId,
  rentAmount
}: {
  email: string;
  propertyId: string;
  landlordId: string;
  rentAmount: number;
}) {

  try {
    // 1. Create the Tenant User document (Pre-auth)
    // In a real app, you'd trigger a Firebase Auth invite email here
    const tenantRef = db.collection('users').doc(); 
    
    await tenantRef.set({
      email: email.toLowerCase(),
      role: 'tenant', // Sets the restricted role
      landlordId: landlordId,
      associatedPropertyId: propertyId,
      status: 'invited',
      billing: {
        rentAmount: rentAmount,
        balance: 0
      },
      metadata: {
        createdAt: FieldValue.serverTimestamp()
      }
    });

    // 2. Link the tenant to the property
    await db.collection('properties').doc(propertyId).update({
      currentTenantId: tenantRef.id,
      tenantEmail: email.toLowerCase()
    });

    return { success: true, tenantId: tenantRef.id };
  } catch (error: any) {
    throw new Error(error.message);
  }
}
