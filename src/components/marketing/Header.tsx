'use client';

import Link from 'next/link';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';

export function Header() {
  const navItems = [
    { name: 'Product', href: '#features' },
    { name: 'How it works', href: '#how-it-works' },
    { name: 'Pricing', href: '#pricing' },
    { name: 'Early Access', href: '/early-access' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-sm border-b border-slate-200">
      <div className="container mx-auto flex h-20 items-center justify-between px-4 md:px-6">
        <Link href="/">
          <Logo />
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          {navItems.map((item) => (
            <Link key={item.name} href={item.href} className="hover:text-primary transition-colors">
              {item.name}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
                <Link href="/login">Log In</Link>
            </Button>
            <Button asChild>
                <Link href="/signup">Sign Up Free</Link>
            </Button>
        </div>
      </div>
    </header>
  );
}
