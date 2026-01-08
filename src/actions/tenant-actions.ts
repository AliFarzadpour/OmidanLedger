'use server';

import { getAuth } from 'firebase-admin/auth';
import { adminApp, db as adminDb } from '@/lib/admin-db';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';


const InviteTenantSchema = z.object({
  email: z.string().email(),
  propertyId: z.string(),
  unitId: z.string().optional(),
  landlordId: z.string(),
});

/**
 * This server action creates a Firebase Auth user and a corresponding Firestore user document.
 * It NO LONGER generates the sign-in link. That is now handled by the client.
 */
export async function inviteTenant(input: z.infer<typeof InviteTenantSchema>) {
  const { email, propertyId, unitId, landlordId } = InviteTenantSchema.parse(input);
  
  const auth = getAuth(adminApp);
  let user;

  // 1. Create or get the Firebase Auth user
  try {
    user = await auth.getUserByEmail(email);
  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      user = await auth.createUser({
        email: email,
        emailVerified: false, // Will be verified by magic link
      });
    } else {
      console.error("Firebase Auth user creation/retrieval error:", error);
      throw new Error(`Failed to process user account: ${error.message}`);
    }
  }
  
  // 2. Create the Firestore user document for the tenant role
  try {
    await adminDb.collection('users').doc(user.uid).set({
      email: email,
      role: 'tenant',
      landlordId: landlordId,
      associatedPropertyId: propertyId,
      ...(unitId && { associatedUnitId: unitId }),
      status: 'invited',
      metadata: {
        createdAt: FieldValue.serverTimestamp(),
      },
      billing: {
        balance: 0,
        rentAmount: 0,
      },
    }, { merge: true });

    // 3. Return success, the client will now trigger the email.
    return { success: true, message: "Tenant account created. Sending invitation email..." };

  } catch (error: any) {
    console.error("Firestore user creation error:", error);
    throw new Error(`Failed to save tenant profile: ${error.message}`);
  }
}
