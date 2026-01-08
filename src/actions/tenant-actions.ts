
'use server';

import { getAuth } from 'firebase-admin/auth';
import { adminApp, db as adminDb } from '@/lib/admin-db';
import { Resend } from 'resend';

type InviteTenantInput = {
  email: string;
  propertyId: string;
  unitId?: string;
  landlordId: string;
  landlordName: string;
  propertyName: string;
};

export async function inviteTenant(input: InviteTenantInput) {
  const { email, propertyId, unitId, landlordId, landlordName, propertyName } = input;
  const adminAuth = getAuth(adminApp);

  if (!email || !propertyId || !landlordId) {
    throw new Error('Missing required fields.');
  }

  // ✅ ALWAYS use a public base URL (never infer host; never default to localhost in prod)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!baseUrl || !/^https?:\/\/.+/i.test(baseUrl)) {
    throw new Error(
      'NEXT_PUBLIC_APP_URL is missing/invalid. Set it to your public app URL (https://...).'
    );
  }

  // This is where Firebase will redirect AFTER the email link is clicked
  const continueUrl = `${baseUrl}/tenant/accept`;

  // ✅ This controls what Firebase embeds into the email link
  const actionCodeSettings = {
    url: continueUrl,
    handleCodeInApp: true,
  };

  // 1) Create (or fetch) Auth user
  let userRecord;
  try {
    userRecord = await adminAuth.getUserByEmail(email);
  } catch {
    userRecord = await adminAuth.createUser({
      email,
      emailVerified: false,
      disabled: false,
    });
  }

  // 2) Write tenant profile in Firestore
  // You can choose your own schema; this matches what your UI implies.
  await adminDb.collection('users').doc(userRecord.uid).set(
    {
      email,
      associatedPropertyId: propertyId,
      ...(unitId && { associatedUnitId: unitId }),
      landlordId,
      metadata: {
        role: 'tenant',
        status: 'invited',
        createdAt: new Date(),
      },
    },
    { merge: true }
  );

  // 3) Generate the magic sign-in link (Admin SDK)
  const signInLink = await adminAuth.generateSignInWithEmailLink(email, actionCodeSettings);

  // 4) Send via Resend (so you control subject/content)
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM; // e.g. "OmidanLedger <no-reply@yourdomain.com>"

  if (!resendKey || !from) {
    // fallback: return link for debugging (DON'T do this in production long-term)
    console.log('TENANT MAGIC LINK:', signInLink);
    return { message: 'Invite created. Email service not configured; link logged to server.' };
  }

  const resend = new Resend(resendKey);

  await resend.emails.send({
    from,
    to: email,
    subject: `${landlordName} invited you to your Tenant Portal (${propertyName})`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5">
        <h2>You're invited to the Tenant Portal</h2>
        <p><b>${landlordName}</b> invited you to access your tenant portal for <b>${propertyName}</b>.</p>
        <p>
          <a href="${signInLink}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none">
            Sign in to Tenant Portal
          </a>
        </p>
        <p>If you didn’t request this, you can ignore this email.</p>
      </div>
    `,
  });

  return { message: `Invitation email was sent to ${email}.` };
}
