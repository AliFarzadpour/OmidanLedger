'use client';

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,    // For Properties
  Wallet,       // For Sales/Income
  CreditCard,   // For Transactions
  FileBarChart, // For Reports
  Users,        // For Vendors
  Settings,
  BookOpen,     // For Bookkeeping setup
  LogOut,
  Landmark      // For Banks
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { useAuth } from "@/firebase";
import { UserNav } from "./dashboard/user-nav";

// We define the menu structure here for easy editing later
const data = {
  navMain: [
    {
      title: "Overview",
      items: [
        {
          title: "Dashboard",
          url: "/dashboard",
          icon: LayoutDashboard,
        },
        {
          title: "Reports",
          url: "/dashboard/reports",
          icon: FileBarChart,
        },
      ],
    },
    {
      title: "Financials (Bookkeeping)",
      items: [
        {
          title: "Transactions",
          url: "/dashboard/transactions",
          icon: CreditCard,
        },
        {
          title: "Revenue & Invoices", // Renamed from 'Sales Hub'
          url: "/dashboard/sales",
          icon: Wallet,
        },
        {
          title: "Vendors",
          url: "/dashboard/vendors",
          icon: Users,
        },
      ],
    },
    {
      title: "Portfolio (Real Estate)",
      items: [
        {
          title: "Properties",
          url: "/dashboard/properties",
          icon: Building2,
        },
        // You can add 'Tenants' here later
        // { title: "Tenants", url: "/dashboard/tenants", icon: UserCheck }
      ],
    },
    {
      title: "System",
      items: [
        {
          title: "Chart of Accounts",
          url: "/dashboard/onboarding/opening-balances",
          icon: BookOpen,
        },
        {
          title: "Settings",
          url: "/dashboard/settings",
          icon: Settings,
        },
      ],
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const auth = useAuth();

  const handleLogout = () => {
    auth.signOut();
  };

  return (
    <Sidebar {...props}>
      <SidebarHeader className="h-16 border-b flex items-center px-4">
        <div className="flex items-center gap-2 font-bold text-xl text-slate-900">
          <Landmark className="h-6 w-6 text-primary" />
          <span className="group-data-[collapsible=icon]:hidden">FiscalFlow</span>
        </div>
      </SidebarHeader>

      <SidebarContent className="p-2">
        {data.navMain.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1 group-data-[collapsible=icon]:hidden">
              {group.title}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  // Check if this item is active
                  const isActive = pathname === item.url || (pathname.startsWith(item.url) && item.url !== '/dashboard');
                  
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        isActive={isActive}
                        tooltip={item.title}
                        className={`hover:bg-blue-50 hover:text-blue-700 transition-colors ${
                          isActive ? 'bg-blue-100 text-blue-800 font-semibold' : 'text-slate-600'
                        }`}
                      >
                        <Link href={item.url}>
                          <item.icon className={`h-4 w-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                          <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-2">
         <UserNav isMobile={false} />
         <SidebarSeparator />
         <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton 
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={handleLogout} 
              >
                <LogOut className="h-4 w-4" />
                <span className="group-data-[collapsible=icon]:hidden">Sign Out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}