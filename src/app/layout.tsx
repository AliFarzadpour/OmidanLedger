import type { Metadata } from 'next';
import './globals.css';
import { cn } from '@/lib/utils';
import { AppProviders } from '@/components/AppProviders';


export const metadata: Metadata = {
  title: 'FiscalFlow | Modern Financial Management',
  description: 'Simplify your property management. Track rent, manage expenses, and generate real-time financial reports in one secure dashboard. Sign in or start today.',
  keywords: 'finance, bookkeeping, accounting, real estate, landlord, rent tracking, expense management, AI finance',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="https://firebasestorage.googleapis.com/v0/b/studio-7576922301-bac28.firebasestorage.app/o/logos%2FFavicon.png?alt=media&token=e5f84106-38f2-4d8c-a550-6e795136aef6" sizes="any" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1E88E5" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={cn('font-body antialiased bg-background')}>
        <AppProviders>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
