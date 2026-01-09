import { headers } from 'next/headers';

export function getAppUrl() {
  try {
    const headersList = headers();
    // Use a more compatible way to get the host
    const host = headersList.get('host') || '';
    const protocol = headersList.get('x-forwarded-proto') || 'https';
    
    if (host) {
      return `${protocol}://${host}`;
    }
  } catch (e) {
    console.warn("Could not determine URL from headers, using fallback.");
  }

  // Fallback to the environment variable we set earlier
  return process.env.APP_URL || 'https://omidanledger.com';
}
