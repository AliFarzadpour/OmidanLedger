'use server';

import { getAppUrl } from "@/lib/url-utils";
import { Resend } from 'resend';
import { db } from '@/lib/firebase-admin'; // Using the admin lib we found in your ls

const resend = new Resend(process.env.RESEND_API_KEY);

export async function inviteTenant({ email, propertyId }: { email: string; propertyId: string }) {
  try {
    // 1. Create/Update the tenant record in Firestore first
    // We use the email as a temporary ID or search key
    await db.collection('users').add({
      email: email.toLowerCase(),
      role: 'tenant',
      tenantPropertyId: propertyId,
      status: 'invited',
      createdAt: new Date().toISOString()
    });

    // 2. Generate the correct /accept link
    const baseUrl = getAppUrl();
    const inviteLink = `${baseUrl}/tenant/accept?propertyId=${propertyId}&email=${encodeURIComponent(email)}`;

    // 3. Send the email
    const { error } = await resend.emails.send({
      from: 'OmidanLedger <notifications@omidanledger.com>',
      to: [email],
      subject: 'Welcome to your Tenant Portal',
      html: `<p>You have been invited to the OmidanLedger Tenant Portal.</p>
             <p><a href="${inviteLink}">Click here to set up your account.</a></p>`
    });

    if (error) {
      console.error('[Resend Error]:', error);
      return { success: false, error: "Email failed, but record was created." };
    }

    return { success: true };
  } catch (err: any) {
    console.error('[Invite Action Error]:', err.message);
    return { success: false, error: err.message };
  }
}
