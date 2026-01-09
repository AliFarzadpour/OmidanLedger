'use server';
import { getAppUrl } from "@/lib/url-utils";


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

  if (!email || !propertyId || !landlordId) {
    throw new Error('Missing required fields.');
  }

  const adminAuth = getAuth(adminApp);

  // ✅ Prefer server env var; forbid localhost in production links
  const baseUrl =
    getAppUrl() ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
    '';

  console.log('[inviteTenant] baseUrl=', baseUrl); // DEBUG LOG
  const continueUrl = `${baseUrl}/tenant/accept`;
  console.log('[inviteTenant] continueUrl=', continueUrl); // DEBUG LOG

  // Allow localhost only for development
  if (process.env.NODE_ENV === 'production' && (!baseUrl || !baseUrl.startsWith('https'))) {
    throw new Error(
      `Production environment is missing a valid HTTPS APP_URL. Got: "${baseUrl}".`
    );
  }

  const actionCodeSettings = {
    url: continueUrl,
    handleCodeInApp: true,
  };

  // 1) Create/fetch Auth user
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

  // 2) Save tenant profile
  await adminDb.collection('users').doc(userRecord.uid).set(
    {
      email,
      associatedPropertyId: propertyId,
      ...(unitId ? { associatedUnitId: unitId } : {}),
      landlordId,
      role: 'tenant', // Explicitly set role
      metadata: {
        role: 'tenant',
        status: 'invited',
        createdAt: new Date(),
      },
    },
    { merge: true }
  );

  // 3) Generate magic link
  const signInLink = await adminAuth.generateSignInWithEmailLink(email, actionCodeSettings);

  // 4) Send email via Resend
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;

  if (!resendKey || !from) {
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
        <p style="color:#666;font-size:12px">This link expires for security. If it expires, request a new invite.</p>
      </div>
    `,
  });

  return { message: `Invitation email was sent to ${email}.` };
}

