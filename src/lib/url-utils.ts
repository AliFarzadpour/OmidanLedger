import { headers } from 'next/headers';

export function getAppUrl() {
  // 1. Try to get the URL from the browser request (Automatic)
  const headersList = headers();
  const host = headersList.get('host');
  const protocol = headersList.get('x-forwarded-proto') || 'https';
  
  if (host) {
    return `${protocol}://${host}`;
  }

  // 2. Fallback (Safe default)
  return process.env.APP_URL || 'https://omidanledger.com';
}
