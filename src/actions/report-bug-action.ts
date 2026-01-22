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

  // 2. Prepare email content and attachment
  const base64Data = screenshotDataUrl.split(',')[1];
  const subject = `New Bug Report from ${userEmail}`;
  const htmlBody = `
    <h1>New Bug Report</h1>
    <p><strong>User:</strong> ${userEmail}</p>
    <p><strong>Page:</strong> <a href="${pageUrl}">${pageUrl}</a></p>
    <p><strong>Notes:</strong></p>
    <blockquote style="background: #f4f4f4; padding: 15px; border-left: 4px solid #d32f2f;">${notes || "No description provided."}</blockquote>
    <p>Screenshot is attached to this email.</p>
  `;

  // 3. Send email via Resend with attachment
  await resend.emails.send({
    from: 'bug-reporter@omidanledger.com',
    to: 'Dev@OmidanAI.com',
    subject,
    html: htmlBody,
    attachments: [
      {
        filename: `bug-report-${reportRef.id}.png`,
        content: base64Data,
      },
    ],
  });

  return { success: true };
}
