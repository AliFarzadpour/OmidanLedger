export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    console.log('Plaid webhook received');
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing Plaid webhook:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
