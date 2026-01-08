'use server';

import { db } from '@/lib/admin-db';
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
    // 1. Generate a secure, unique token for the invitation
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Invitation valid for 7 days

    // 2. Create an `invites` document
    const inviteRef = doc(collection(db, 'invites'));
    await inviteRef.set({
      id: inviteRef.id,
      email: email.toLowerCase(),
      landlordId,
      propertyId,
      ...(unitId && { unitId }),
      role: 'tenant',
      status: 'invited',
      token,
      expiresAt: Timestamp.fromDate(expiresAt),
      createdAt: FieldValue.serverTimestamp(),
    });

    // 3. (Simulate) Send an email with the magic link
    const acceptUrl = `${process.env.NEXT_PUBLIC_APP_URL}/tenant/accept?token=${token}`;
    
    // In a real app, you would use an email service (e.g., SendGrid, Resend) here.
    // For this environment, we'll log it to the console.
    console.log("--- TENANT INVITE: PLEASE SHARE THIS LINK ---");
    console.log(`To: ${email}`);
    console.log(`Subject: You're invited to your Tenant Portal`);
    console.log(`Body: Click this link to access your portal: ${acceptUrl}`);
    console.log("---------------------------------------------");

    return { success: true, message: `An invitation link has been generated for ${email}. Please check the server console for the link.` };
  } catch (error: any) {
    console.error("Error inviting tenant:", error);
    throw new Error(error.message);
  }
}
