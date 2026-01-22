'use server';

import { getAdminDb } from '@/lib/firebaseAdmin';
import { Resend } from 'resend';
import { FieldValue } from 'firebase-admin/firestore';

const db = getAdminDb();
const resend = new Resend(process.env.RESEND_API_KEY);

interface ReportBugParams {
  screenshotDataUrl: string;
  userEmail: string;
  notes: string;
  pageUrl: string;
  browser: string;
  userId: string;
}

export async function reportBug({ screenshotDataUrl, userEmail, notes, pageUrl, browser, userId }: ReportBugParams) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('Resend API key is not configured.');
  }

  // --- FETCH USER DETAILS ---
  let userDetailsHtml = `<p><strong>User:</strong> ${userEmail} (${userId})</p>`;
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
        const userData = userDoc.data();
        userDetailsHtml += `
            <p><strong>Role:</strong> ${userData?.role || 'N/A'}</p>
            <p><strong>Business Name:</strong> ${userData?.businessProfile?.businessName || 'N/A'}</p>
            <p><strong>Subscription:</strong> ${userData?.billing?.subscriptionTier || 'N/A'}</p>
        `;
    }
  } catch (e) {
      console.error("Could not fetch additional user details for bug report", e);
  }
  // --- END FETCH ---

  // 1. Save report to Firestore (without a public URL)
  const reportRef = db.collection('bug_reports').doc();
  await reportRef.set({
      id: reportRef.id,
      description: notes,
      userEmail: userEmail,
      pageUrl: pageUrl,
      browser: browser,
      createdAt: FieldValue.serverTimestamp(),
      status: 'open',
      userId: userId,
  });

  // 2. Prepare admin email content
  const base64Data = screenshotDataUrl.split(',')[1];
  const adminSubject = `New Bug Report from ${userEmail}`;
  const adminHtmlBody = `
    <h1>New Bug Report</h1>
    ${userDetailsHtml}
    <p><strong>Page:</strong> <a href="${pageUrl}">${pageUrl}</a></p>
    <p><strong>Browser:</strong> ${browser}</p>
    <p><strong>Notes:</strong></p>
    <blockquote style="background: #f4f4f4; padding: 15px; border-left: 4px solid #d32f2f;">${notes || "No description provided."}</blockquote>
    <p>Screenshot is attached to this email.</p>
  `;

  // 3. Send both emails concurrently
  await Promise.all([
    // Email to Admin
    resend.emails.send({
        from: 'bug-reporter@omidanledger.com',
        to: 'Dev@OmidanAI.com',
        subject: adminSubject,
        html: adminHtmlBody,
        attachments: [
            {
            filename: `bug-report-${reportRef.id}.png`,
            content: base64Data,
            },
        ],
    }),
    // Thank you email to the user
    resend.emails.send({
        from: 'support@omidanledger.com',
        to: userEmail,
        subject: 'Thank You for Your Bug Report!',
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                <h2 style="color: #1e293b;">We've Received Your Report</h2>
                <p>Hi there,</p>
                <p>Thank you for taking the time to submit a bug report. We appreciate you helping us make OmidanLedger better.</p>
                <p>We have added your feedback to our development queue and our team will investigate the issue. We will notify you as soon as a fix has been deployed.</p>
                <p>If you have any more details to add, please don't hesitate to reply to this email.</p>
                <br>
                <p>Best,</p>
                <p>The OmidanLedger Team</p>
            </div>
        `,
    })
  ]);


  return { success: true };
}
