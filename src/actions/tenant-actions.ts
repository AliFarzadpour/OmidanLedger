'use server';

import { adminApp, db as adminDb } from '@/lib/admin-db';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { sendTenantInviteEmail } from '@/lib/email';

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

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!baseUrl || !baseUrl.startsWith('http')) {
    throw new Error("NEXT_PUBLIC_APP_URL is missing or invalid in your environment variables.");
  }
  const continueUrl = `${baseUrl}/tenant/accept`;

  try {
    user = await auth.getUserByEmail(email).catch(async (e) => {
      if (e.code === 'auth/user-not-found') {
        return await auth.createUser({ email, emailVerified: false });
      }
      throw e;
    });

    const landlordDoc = await adminDb.collection('users').doc(landlordId).get();
    const propertyDoc = await adminDb.collection('properties').doc(propertyId).get();
    
    if (!landlordDoc.exists() || !propertyDoc.exists()) {
        throw new Error("Landlord or Property not found.");
    }
    
    const landlordName = landlordDoc.data()?.businessProfile?.businessName || landlordDoc.data()?.name || 'Your Landlord';
    const propertyName = propertyDoc.data()?.name || 'Your Property';

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

    const link = await auth.generateSignInWithEmailLink(email, {
      url: continueUrl,
      handleCodeInApp: true,
    });

    await sendTenantInviteEmail({
      to: email,
      landlordName: landlordName,
      propertyName: propertyName,
      link: link
    });

    return { success: true, message: "Tenant invitation sent successfully." };

  } catch (error: any) {
    console.error("Error in inviteTenant action:", error);
    throw new Error(error.message || "Failed to invite tenant.");
  }
}
