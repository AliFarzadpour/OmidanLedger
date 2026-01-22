'use server';

import { getAdminStorage } from '@/lib/firebaseAdmin';
import { Resend } from 'resend';
import { v4 as uuidv4 } from 'uuid';

const resend = new Resend(process.env.RESEND_API_KEY);

interface ReportBugParams {
  screenshotDataUrl: string;
  userEmail: string;
  notes: string;
  pageUrl: string;
}

export async function reportBug({ screenshotDataUrl, userEmail, notes, pageUrl }: ReportBugParams) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('Resend API key is not configured.');
  }

  // 1. Upload screenshot to Firebase Storage
  const storage = getAdminStorage();
  const bucket = storage.bucket(); 

  const base64Data = screenshotDataUrl.split(',')[1];
  const buffer = Buffer.from(base64Data, 'base64');
  const fileName = `bug-reports/${uuidv4()}.png`;
  const file = bucket.file(fileName);

  await file.save(buffer, {
    metadata: {
      contentType: 'image/png',
    },
  });

  // Make the file publicly readable to get a URL
  await file.makePublic();
  const downloadURL = file.publicUrl();

  // 2. Send email via Resend
  const subject = `New Bug Report from ${userEmail}`;
  const htmlBody = `
    <h1>New Bug Report</h1>
    <p><strong>User:</strong> ${userEmail}</p>
    <p><strong>Page:</strong> <a href="${pageUrl}">${pageUrl}</a></p>
    <p><strong>Notes:</strong></p>
    <p>${notes}</p>
    <p><strong>Screenshot:</strong></p>
    <a href="${downloadURL}"><img src="${downloadURL}" alt="Screenshot" style="max-width: 600px; border: 1px solid #ccc;" /></a>
  `;

  await resend.emails.send({
    from: 'bug-reporter@omidanledger.com',
    to: 'Dev@OmidanAI.com',
    subject,
    html: htmlBody,
  });

  return { success: true, downloadURL };
}
