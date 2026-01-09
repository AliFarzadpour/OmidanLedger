export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log('Plaid webhook received:', body.webhook_type);
    
    // We simply return 200 OK to acknowledge receipt.
    // The actual sync logic will run when the app is live.
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing Plaid webhook:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
