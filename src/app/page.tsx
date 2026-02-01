import { Hero } from '@/components/marketing/Hero';
import { Features } from '@/components/marketing/Features';
import { HowItWorks } from '@/components/marketing/HowItWorks';
import { Testimonials } from '@/components/marketing/Testimonials';
import { FAQ } from '@/components/marketing/FAQ';
import { Footer } from '@/components/marketing/Footer';
import { Header } from '@/components/marketing/Header';
import { EarlyAccessStrip } from '@/components/marketing/EarlyAccessStrip';
import { Pricing } from '@/components/marketing/Pricing';
import { FinalCTA } from '@/components/marketing/FinalCTA';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'OmidanLedger | Automated Bookkeeping for Landlords',
    description: 'The all-in-one financial dashboard for landlords. Automate bookkeeping, track rental income, and generate tax-ready reports with ease. Stop guessing, know your numbers.',
    alternates: {
        canonical: 'https://omidanledger.com',
    },
    openGraph: {
        title: 'OmidanLedger | Automated Bookkeeping for Landlords',
        description: 'The all-in-one financial dashboard for landlords. Ditch spreadsheet chaos and see your portfolio’s real performance.',
        url: 'https://omidanledger.com',
        siteName: 'OmidanLedger',
        images: [
            {
                url: 'https://firebasestorage.googleapis.com/v0/b/studio-7576922301-bac28.firebasestorage.app/o/logos%2FScreenshot%20omidanledger%20Dashboard.png?alt=media&token=0932bb0c-c929-4280-917f-b691d187d052', // An engaging OG image
                width: 1200,
                height: 630,
            },
        ],
        locale: 'en_US',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'OmidanLedger | Automated Bookkeeping for Landlords',
        description: 'The all-in-one financial dashboard for landlords.',
        images: ['https://firebasestorage.googleapis.com/v0/b/studio-7576922301-bac28.firebasestorage.app/o/logos%2FScreenshot%20omidanledger%20Dashboard.png?alt=media&token=0932bb0c-c929-4280-917f-b691d187d052'],
    },
    other: {
        'json-ld': JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'OmidanLedger',
            applicationCategory: 'FinanceApplication',
            operatingSystem: 'Web',
            offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'USD',
                availability: 'https://schema.org/InStock',
                seller: {
                    '@type': 'Organization',
                    name: 'OmidanLedger',
                },
            },
            aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: '4.9',
                reviewCount: '18',
            },
            description: 'The all-in-one financial dashboard for landlords to automate bookkeeping, track rental income, and generate tax-ready reports.',
        }),
    },
};


export default function MarketingHomePage() {
  return (
    <div className="bg-white text-slate-800">
      <Header />
      <main>
        <Hero />
        <EarlyAccessStrip />
        <Features />
        <HowItWorks />
        <Testimonials />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
