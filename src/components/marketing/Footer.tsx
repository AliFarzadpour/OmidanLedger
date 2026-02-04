
import Link from 'next/link';
import { Logo } from '@/components/logo';

export function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-300">
      <div className="container mx-auto px-4 md:px-6 py-12">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="space-y-4">
            <Logo />
            <p className="text-sm">The all-in-one financial dashboard for landlords.</p>
            <div className="pt-2">
                <h3 className="font-semibold text-white mb-2">Contact Support</h3>
                <a href="mailto:support@omidanledger.com" className="text-sm text-primary hover:underline">
                    support@omidanledger.com
                </a>
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-white mb-4">Product</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="#features" className="hover:text-white">Features</Link></li>
              <li><Link href="#how-it-works" className="hover:text-white">How it Works</Link></li>
              <li><Link href="#pricing" className="hover:text-white">Pricing</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-white mb-4">Company</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/about" className="hover:text-white">About</Link></li>
              <li><Link href="/faq" className="hover:text-white">FAQ</Link></li>
              <li><Link href="/early-access" className="hover:text-white">Early Access</Link></li>
               <li><Link href="mailto:support@omidanledger.com" className="hover:text-white">Contact</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-white mb-4">Legal</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/disclaimer" className="hover:text-white">Disclaimer</Link></li>
              <li><Link href="/privacy" className="hover:text-white">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-white">Terms of Service</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-12 border-t border-slate-700 pt-8 text-center text-sm text-slate-400">
          <p>&copy; 2026 OmidanLedger. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
