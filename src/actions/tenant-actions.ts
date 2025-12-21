'use server';

import { db } from '@/lib/admin-db';
import { FieldValue } from 'firebase-admin/firestore';

export async function inviteTenant({
  email,
  propertyId,
  unitId, // <-- ADDED
  landlordId,
}: {
  email: string;
  propertyId: string;
  unitId?: string; // <-- ADDED
  landlordId: string;
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
      ...(unitId && { associatedUnitId: unitId }), // <-- ADDED: Link to unit
      status: 'invited',
      billing: {
        balance: 0
      },
      metadata: {
        createdAt: FieldValue.serverTimestamp()
      }
    });

    // 2. Link the tenant to the property or unit
    // THIS LOGIC HAS BEEN REMOVED. The tenant is now managed manually in the drawer.
    // This action's only job is to create the user account for the portal.

    return { success: true, tenantId: tenantRef.id };
  } catch (error: any) {
    throw new Error(error.message);
  }
}
