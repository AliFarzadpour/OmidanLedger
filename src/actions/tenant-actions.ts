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
        rentAmount: 0,
        balance: 0
      },
      metadata: {
        createdAt: FieldValue.serverTimestamp()
      }
    });

    // 2. Link the tenant to the property or unit
    if (unitId) {
        // For multi-family, add tenant to the unit's tenant array
        const unitRef = db.doc(`properties/${propertyId}/units/${unitId}`);
        await unitRef.update({
            tenants: FieldValue.arrayUnion({
                id: tenantRef.id,
                email: email.toLowerCase(),
                firstName: email.split('@')[0],
                lastName: '',
                rentAmount: 0,
                leaseStart: '',
                leaseEnd: '',
            })
        });
    } else {
        // For single-family, link directly to the property
        await db.collection('properties').doc(propertyId).update({
            currentTenantId: tenantRef.id,
            tenantEmail: email.toLowerCase()
        });
    }


    return { success: true, tenantId: tenantRef.id };
  } catch (error: any) {
    throw new Error(error.message);
  }
}
