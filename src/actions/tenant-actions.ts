
'use server';

import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { adminApp, db as adminDb } from '@/lib/admin-db';

const InviteTenantSchema = z.object({
  email: z.string().email(),
  propertyId: z.string(),
  unitId: z.string().optional(),
  landlordId: z.string(),
  landlordName: z.string().optional(), // Added to pass to email template
});

/**
 * Server Action: Creates a tenant user in Firebase Auth and Firestore.
 * This action does NOT send the email. The client is responsible for that.
 */
export async function inviteTenant(input: z.infer<typeof InviteTenantSchema>) {
  const { email, propertyId, unitId, landlordId } = InviteTenantSchema.parse(input);
  
  const auth = getAuth(adminApp);
  let user;

  try {
    // 1. Create or get the Auth user on the server.
    user = await auth.getUserByEmail(email).catch(async (e) => {
      if (e.code === 'auth/user-not-found') {
        return await auth.createUser({ email, emailVerified: false });
      }
      throw e;
    });

    if (!user) {
        throw new Error('Could not create or find user in Firebase Auth.');
    }

    // 2. Create the user's profile in Firestore.
    await adminDb.collection('users').doc(user.uid).set({
      email: email,
      role: 'tenant',
      landlordId: landlordId,
      associatedPropertyId: propertyId,
      ...(unitId && { associatedUnitId: unitId }),
      status: 'invited',
      metadata: { createdAt: FieldValue.serverTimestamp() },
      billing: { balance: 0, rentAmount: 0 },
    }, { merge: true });

    // 3. Return success to the client, so it can trigger the email.
    return { success: true, message: "Tenant user created successfully. Client will now send the email." };

  } catch (error: any) {
    console.error("Error in inviteTenant action:", error);
    // Forward a clean error message to the client.
    throw new Error(error.message || "Failed to create tenant user on the server.");
  }
}
