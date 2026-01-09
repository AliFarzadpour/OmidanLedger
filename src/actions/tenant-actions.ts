'use server';

import { getAppUrl } from "@/lib/url-utils";
import { Resend } from 'resend';

// We initialize inside the function to ensure the API key is loaded from the environment
export async function inviteTenant({ email, propertyId }: { email: string; propertyId: string }) {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not configured on the server.");
    }

    const resend = new Resend(apiKey);
    const baseUrl = getAppUrl();
    const inviteLink = `${baseUrl}/tenant/setup?propertyId=${propertyId}&email=${encodeURIComponent(email)}`;

    const { error } = await resend.emails.send({
      from: 'OmidanLedger <notifications@omidanledger.com>',
      to: [email],
      subject: 'Welcome to your Tenant Portal',
      html: `<p>You have been invited to the OmidanLedger Tenant Portal.</p>
             <p><a href="${inviteLink}">Click here to set up your account.</a></p>`
    });

    if (error) {
      console.error('[Resend Error]:', error);
      return { success: false, error: "Email service failed. Please contact support." };
    }

    return { success: true };
  } catch (err: any) {
    console.error('[Invite Error]:', err.message);
    return { success: false, error: err.message || "An unexpected error occurred." };
  }
}
