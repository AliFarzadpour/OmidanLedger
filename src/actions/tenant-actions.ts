'use server';

import { getAppUrl } from "@/lib/url-utils";
import { Resend } from 'resend';
import * as admin from '@/lib/firebase-admin';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function inviteTenant({ email, propertyId }: { email: string; propertyId: string }) {
  try {
    // Attempt to find the database instance from the admin module
    // It is often exported as 'db' or 'admin.firestore()'
    const db = admin.db || (admin.admin && admin.admin.firestore());
    
    if (!db) {
      throw new Error("Could not initialize Firebase Admin Database");
    }

    // 1. Create the placeholder record
    await db.collection('users').add({
      email: email.toLowerCase(),
      role: 'tenant',
      tenantPropertyId: propertyId,
      status: 'invited',
      createdAt: new Date().toISOString()
    });

    // 2. Generate the link
    const baseUrl = getAppUrl();
    const inviteLink = `${baseUrl}/tenant/accept?propertyId=${propertyId}&email=${encodeURIComponent(email)}`;

    // 3. Send email
    await resend.emails.send({
      from: 'OmidanLedger <notifications@omidanledger.com>',
      to: [email],
      subject: 'Welcome to your Tenant Portal',
      html: `<p>You have been invited to the OmidanLedger Tenant Portal.</p>
             <p><a href="${inviteLink}">Click here to set up your account.</a></p>`
    });

    return { success: true };
  } catch (err: any) {
    console.error('Invite Error:', err.message);
    return { success: false, error: err.message };
  }
}
