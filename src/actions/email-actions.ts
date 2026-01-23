'use server';

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendWelcomeEmail({ email, name }: { email: string, name?: string | null }) {
    if (!process.env.RESEND_API_KEY) {
        console.error('Resend API key is not configured. Skipping welcome email.');
        return;
    }

    try {
        const data = await resend.emails.send({
            from: 'Ali from Omidan <ali@omidanledger.com>',
            to: [email],
            reply_to: 'Dev@OmidanAI.com',
            subject: 'Welcome to the Private Beta (and how to start)',
            text: `Hi ${name || 'there'}, welcome to OmidanLedger... (Plain text version)`, 
            html: `
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
                <style>
                  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; }
                  .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px; }
                  .button { display: inline-block; background-color: #2563EB; color: #ffffff !important; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 10px; }
                  .highlight-box { background-color: #f8f9fa; border-left: 4px solid #2563EB; padding: 15px; margin: 20px 0; }
                  .warning-box { background-color: #fff5f5; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0; }
                  h2 { color: #111; font-size: 20px; margin-top: 30px; }
                  li { margin-bottom: 10px; }
                </style>
              </head>
              <body>
                <div class="container">
                  <img src="https://firebasestorage.googleapis.com/v0/b/studio-7576922301-bac28.firebasestorage.app/o/logos%2FOmidanLedger%20logo%20Rightside%20trimed.png?alt=media&token=80772977-26b5-4080-b0f4-30eccf9cc323" alt="OmidanLedger Logo" style="width: 150px; margin-bottom: 20px;" />
                  <p>Hi ${name || 'there'},</p>
                  
                  <p>I’m Ali, the creator of OmidanLedger. I built this because I got tired of fighting with spreadsheets to track my rental properties.</p>

                  <div class="highlight-box">
                    <strong>🎉 You are a Founding Member</strong><br/>
                    By joining early, you get the platform for free right now, and you've locked in a <strong>50% lifetime discount</strong> for when we eventually launch paid plans.
                  </div>

                  <h2>🚀 How to get set up in 5 minutes</h2>
                  <p>The app is powerful, but it needs your data to work. Follow this exact order:</p>
                  <ol>
                    <li><strong>Add a Property:</strong> Go to the "Properties" tab and add your first building.</li>
                    <li><strong>Enable Accounting:</strong> Inside that property, turn on the "Accounting" feature.</li>
                    <li><strong>Connect Bank:</strong> Link your bank account safely via Plaid.</li>
                    <li><strong>Teach the AI:</strong> Categorize the first few transactions manually—the system learns from you.</li>
                  </ol>

                  <h2>🤝 Need help? Let's jump on a call.</h2>
                  <p>Since we are in Beta, I want to make sure you get set up perfectly. If you are stuck or just want a tour, book a free onboarding session with me:</p>
                  
                  <p style="text-align: center;">
                    <a href="https://calendar.app.google/7otbXee4xsXWU91e8" class="button">Book 30-Min Onboarding</a>
                  </p>

                  <div class="warning-box">
                    <strong>⚠️ One last request (The Beta Pact)</strong><br/>
                    You might see bugs. If a button breaks, please don't just close the tab.<br/><br/>
                    Click the red <strong>🐞 Report Bug</strong> button in the bottom right corner of the app. It sends me a screenshot so I can fix it immediately.
                  </div>

                  <p>Welcome to the inner circle.</p>
                  <br/>
                  <p>Best,<br/><strong>Ali</strong><br/>Founder, OmidanLedger</p>
                </div>
              </body>
              </html>
            `,
        });
        return { success: true, data };
    } catch (error) {
        console.error("Failed to send welcome email:", error);
        // Don't throw error to client, just log it. Email is non-critical.
        return { success: false, error: (error as Error).message };
    }
}
