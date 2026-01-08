
'use server';

import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { adminApp, db as adminDb } from '@/lib/admin-db';
import { sendTenantInviteEmail } from '@/lib/email';

const InviteTenantSchema = z.object({
  email: z.string().email(),
  propertyId: z.string(),
  unitId: z.string().optional(),
  landlordId: z.string(),
  landlordName: z.string().optional(),
  propertyName: z.string().optional(),
});

export async function inviteTenant(input: z.infer<typeof InviteTenantSchema>) {
  const { email, propertyId, unitId, landlordId, landlordName, propertyName } = InviteTenantSchema.parse(input);
  
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
    const landlordDoc = await adminDb.collection('users').doc(landlordId).get();
    if (!landlordDoc.exists) {
        throw new Error('Landlord profile not found.');
    }

    const propertyDoc = await adminDb.collection('properties').doc(propertyId).get();
     if (!propertyDoc.exists) {
        throw new Error('Property profile not found.');
    }
    
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

    // 3. Generate the sign-in link on the server.
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!baseUrl || !baseUrl.startsWith('http')) {
        throw new Error('NEXT_PUBLIC_APP_URL environment variable is missing or invalid.');
    }
    const continueUrl = `${baseUrl}/tenant/accept`;
    const actionCodeSettings = { url: continueUrl, handleCodeInApp: true };
    const link = await auth.generateSignInWithEmailLink(email, actionCodeSettings);
    
    // 4. Send the custom email.
    await sendTenantInviteEmail({
        to: email,
        link: link,
        landlordName: landlordName || 'Your Landlord',
        propertyName: propertyName || 'your property'
    });

    return { success: true, message: `Invitation sent to ${email}.` };

  } catch (error: any) {
    console.error("Error in inviteTenant action:", error);
    throw new Error(error.message || "Failed to create tenant user on the server.");
  }
}
