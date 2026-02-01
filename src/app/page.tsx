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
