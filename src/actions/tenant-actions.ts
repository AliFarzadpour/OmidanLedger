
'use server';

import { db as adminDb } from '@/lib/admin-db';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { v4 as uuidv4 } from 'uuid';

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
    const auth = getAuth();
    let user;

    // 1. Create or get the Firebase Auth user
    try {
      user = await auth.getUserByEmail(email);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        user = await auth.createUser({
          email: email,
          emailVerified: false,
        });
      } else {
        throw error; // Re-throw other auth errors
      }
    }
    
    // 2. Create the Firestore user document
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
    
    // 3. Generate the magic link for sign-in
    const link = await auth.generateSignInWithEmailLink(email, {
      url: `${process.env.NEXT_PUBLIC_APP_URL}/tenant/accept?uid=${user.uid}`,
    });

    // In a real app, you would use an email service (e.g., SendGrid, Resend) here.
    // For this environment, we'll log it to the console.
    console.log("--- TENANT INVITE: PLEASE SHARE THIS LINK ---");
    console.log(`To: ${email}`);
    console.log(`Subject: You're invited to your Tenant Portal`);
    console.log(`Body: Click this link to access your portal: ${link}`);
    console.log("---------------------------------------------");

    return { success: true, message: `An invitation link has been generated for ${email}. Please check the server console for the link.` };
  } catch (error: any) {
    console.error("Error inviting tenant:", error);
    throw new Error(error.message);
  }
}
