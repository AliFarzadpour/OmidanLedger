import { NextResponse } from 'next/server';
import { Resend } from 'resend';

// Initialize Resend with your API Key
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { description, screenshotUrl, userEmail, pageUrl, browser } = body;

    // Send the email to YOU (the admin)
    const data = await resend.emails.send({
      from: 'OmidanLedger Bugs <onboarding@resend.dev>', // Change this to your domain if verified
      to: ['ali.farzadpour@gmail.com'], // CHANGE THIS TO YOUR EMAIL
      subject: `🐞 New Bug Report from ${userEmail}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #d32f2f;">New Bug Report</h1>
          <p><strong>User:</strong> ${userEmail}</p>
          <p><strong>Page:</strong> <a href="${pageUrl}">${pageUrl}</a></p>
          <p><strong>Browser:</strong> ${browser}</p>
          
          <h3>Description:</h3>
          <blockquote style="background: #f4f4f4; padding: 15px; border-left: 4px solid #d32f2f;">
            ${description || "No description provided."}
          </blockquote>

          <h3>Screenshot:</h3>
          <p>
            <a href="${screenshotUrl}" style="background: #0070f3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
              View Full Screenshot
            </a>
          </p>
          <div style="border: 1px solid #ddd; padding: 10px; margin-top: 10px;">
            <img src="${screenshotUrl}" alt="Bug Screenshot" style="max-width: 100%; height: auto;" />
          </div>
        </div>
      `,
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Resend Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
