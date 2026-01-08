
'use server';

import { adminApp, db as adminDb } from '@/lib/admin-db';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';

const InviteTenantSchema = z.object({
  email: z.string().email(),
  propertyId: z.string(),
  unitId: z.string().optional(),
  landlordId: z.string(),
});

export async function inviteTenant(input: z.infer<typeof InviteTenantSchema>) {
  const { email, propertyId, unitId, landlordId } = InviteTenantSchema.parse(input);
  
  const auth = getAuth(adminApp);
  let user;

  try {
    // This server action is now ONLY responsible for creating the Auth user
    // and the Firestore user document. It does NOT send the email.
    user = await auth.getUserByEmail(email).catch(async (e) => {
      if (e.code === 'auth/user-not-found') {
        return await auth.createUser({ email, emailVerified: false });
      }
      throw e;
    });

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

    return { success: true, message: "Tenant user created successfully. Client will send email." };

  } catch (error: any) {
    console.error("Error in inviteTenant action:", error);
    throw new Error(error.message || "Failed to create tenant user.");
  }
}
