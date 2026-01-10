// src/app/api/plaid/health/route.ts
import { NextResponse } from 'next/server';

/**
 * Plaid Health Check API Route.
 *
 * This endpoint verifies that the necessary Plaid environment variables are
 * available in the server runtime (e.g., Firebase App Hosting).
 *
 * Required Environment Variables:
 * - PLAID_CLIENT_ID
 * - PLAID_SECRET
 * - PLAID_ENV (optional, defaults to 'sandbox')
 */
export async function GET() {
  const healthStatus = {
    env: process.env.PLAID_ENV || null,
    hasClientId: !!process.env.PLAID_CLIENT_ID,
    hasSecret: !!process.env.PLAID_SECRET,
  };

  const isHealthy = healthStatus.hasClientId && healthStatus.hasSecret;

  return NextResponse.json(healthStatus, {
    status: isHealthy ? 200 : 500,
  });
}
