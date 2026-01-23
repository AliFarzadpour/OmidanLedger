import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY!);

export async function sendTenantInviteEmail(params: {
  to: string;
  landlordName: string;
  propertyName: string;
  link: string;
}) {
  const { to, landlordName, propertyName, link } = params;

  const subject = `You're invited to your Tenant Portal for ${propertyName}`;

  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <script type="application/ld+json">
    {
      "@context": "http://schema.org",
      "@type": "EmailMessage",
      "publisher": {
        "@type": "Organization",
        "name": "OmidanLedger",
        "logo": {
          "@type": "ImageObject",
          "url": "https://firebasestorage.googleapis.com/v0/b/studio-7576922301-bac28.firebasestorage.app/o/logos%2FFavicon.png?alt=media&token=e5f84106-38f2-4d8c-a550-6e795136aef6"
        }
      }
    }
    </script>
  </head>
  <body>
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#333;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:8px;padding:24px;">
      <h2 style="color:#1e293b;">Welcome to OmidanLedger</h2>
      <p>${landlordName} has invited you to set up your secure tenant portal for <b>${propertyName}</b>.</p>
      <p>In the portal, you can view your balance and make payments online. Click the link below to create your account and set a password.</p>
      <p style="margin:24px 0;">
        <a href="${link}" style="display:inline-block;padding:12px 20px;background-color:#1E88E5;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">
          Create Your Account
        </a>
      </p>
      <p style="color:#64748b;font-size:12px;">This link is valid for 72 hours. If you didn’t expect this, you can safely ignore this email.</p>
    </div>
  </body>
  </html>
  `;

  await resend.emails.send({
    from: process.env.RESEND_FROM || 'onboarding@omidanledger.com',
    to,
    subject,
    html,
  });
}
