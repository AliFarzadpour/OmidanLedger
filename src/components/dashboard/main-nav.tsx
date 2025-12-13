'use client';

import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarSeparator
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  Settings,
  BookCopy,
  BookUser,
  Briefcase,
  Book,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

const primaryMenuItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/sales', label: 'Sales Hub', icon: Briefcase },
  { href: '/dashboard/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/dashboard/reports', label: 'Reports', icon: BookCopy },
];

const secondaryMenuItems = [
    { href: '/dashboard/onboarding/opening-balances', label: 'Bookkeeping Setup', icon: BookUser },
]

export function MainNav() {
  const pathname = usePathname();

  return (
    <>
    <SidebarMenu>
      {primaryMenuItems.map((item) => (
        <SidebarMenuItem key={item.href}>
          <SidebarMenuButton
            as={Link}
            href={item.href}
            isActive={pathname.startsWith(item.href) && (item.href !== '/dashboard' || pathname === '/dashboard')}
            tooltip={item.label}
          >
            <item.icon />
            <span>{item.label}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
    
    <SidebarSeparator />
    
    <SidebarGroup>
        <SidebarGroupLabel className="flex items-center">
            <Book className="mr-2" />
            <span>Bookkeeping</span>
        </SidebarGroupLabel>
        <SidebarGroupContent>
             <SidebarMenu>
                {secondaryMenuItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                        as={Link}
                        href={item.href}
                        isActive={pathname.startsWith(item.href)}
                        tooltip={item.label}
                    >
                        <item.icon />
                        <span>{item.label}</span>
                    </SidebarMenuButton>
                    </SidebarMenuItem>
                ))}
            </SidebarMenu>
        </SidebarGroupContent>
    </SidebarGroup>

    <SidebarSeparator />
    
    <SidebarMenu>
         <SidebarMenuItem>
          <SidebarMenuButton
            as={Link}
            href={'/dashboard/settings'}
            isActive={pathname.startsWith('/dashboard/settings')}
            tooltip={'Settings'}
          >
            <Settings />
            <span>Settings</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
    </SidebarMenu>
    </>
  );
}
