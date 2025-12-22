'use server';

import { db } from '@/lib/admin-db';
import { FieldValue } from 'firebase-admin/firestore';

export async function inviteTenant({
  email,
  propertyId,
  unitId,
  landlordId,
}: {
  email: string;
  propertyId: string;
  unitId?: string;
  landlordId: string;
}) {

  try {
    // 1. Create the Tenant User document (Pre-auth)
    const tenantRef = db.collection('users').doc(); 
    const tenantId = tenantRef.id;
    
    await tenantRef.set({
      id: tenantId, // Self-reference the ID
      email: email.toLowerCase(),
      role: 'tenant',
      landlordId: landlordId,
      associatedPropertyId: propertyId,
      ...(unitId && { associatedUnitId: unitId }),
      status: 'invited',
      billing: {
        balance: 0,
        rentAmount: 0 // Will be set later
      },
      metadata: {
        createdAt: FieldValue.serverTimestamp()
      }
    });

    // 2. Link the tenant to the specific unit
    if (unitId) {
        const unitRef = db.collection('properties').doc(propertyId).collection('units').doc(unitId);
        
        // Atomically add the new tenant to the 'tenants' array in the unit document.
        await unitRef.update({
            tenants: FieldValue.arrayUnion({
                id: tenantId,
                email: email.toLowerCase(),
                firstName: email.split('@')[0], // Default first name
                lastName: '',
                leaseStart: '',
                leaseEnd: '',
                rentAmount: 0,
                deposit: 0
            })
        });
    }

    return { success: true, tenantId: tenantId };
  } catch (error: any) {
    console.error("Error inviting tenant:", error);
    throw new Error(error.message);
  }
}
