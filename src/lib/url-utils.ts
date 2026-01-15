import { headers } from 'next/headers';

export function getAppUrl() {
  // Prioritize the environment variable for consistency across environments.
  if (process.env.APP_URL) {
    return process.env.APP_URL;
  }

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

  // Fallback for local development if APP_URL is not set.
  return 'http://localhost:3000';
}
