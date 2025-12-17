'use client';

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,    // Properties
  Users,        // Tenants/Vendors
  CreditCard,   // Transactions
  FileText,     // Invoices
  PieChart,     // Reports
  Settings,
  Landmark,     // Main Logo
  ArrowLeftRight // Switcher icon (visual only for now)
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
} from "@/components/ui/sidebar";

const data = {
  // Zone 1: The "Physical" World (Real Estate)
  realEstate: [
    {
      title: "Properties",
      url: "/dashboard/properties",
      icon: Building2,
    },
    {
      title: "Tenants",
      // We can point this to the property list for now, or a specific tenant list later
      url: "/dashboard/properties?view=tenants", 
      icon: Users,
    },
  ],
  
  // Zone 2: The "Money" World (Bookkeeping)
  accounting: [
    {
      title: "Transactions",
      url: "/dashboard/transactions",
      icon: CreditCard,
    },
    {
      title: "Invoices & Billing",
      url: "/dashboard/sales",
      icon: FileText,
    },
    {
      title: "Reports",
      url: "/dashboard/reports",
      icon: PieChart,
    },
  ],

  // Zone 3: System
  system: [
    {
      title: "Settings",
      url: "/dashboard/settings",
      icon: Settings,
    },
  ]
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();

  return (
    <Sidebar variant="inset" className="border-r" {...props}>
      <SidebarHeader className="h-16 flex items-center px-6 border-b bg-white">
        <div className="flex items-center gap-2 font-bold text-xl text-slate-900">
          <Landmark className="h-6 w-6 text-blue-600" />
          <span>FiscalFlow</span>
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-slate-50/50">
        
        {/* GROUP 1: REAL ESTATE */}
        <SidebarGroup>
          <SidebarGroupLabel className="tracking-widest text-slate-500 font-bold text-xs mt-4 mb-2">
            REAL ESTATE
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {data.realEstate.map((item) => {
                const isActive = pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive} className="h-10">
                      <Link href={item.url} className={isActive ? "font-medium text-blue-700" : "text-slate-600"}>
                        <item.icon className="mr-2 h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* GROUP 2: ACCOUNTING */}
        <SidebarGroup>
          <SidebarGroupLabel className="tracking-widest text-slate-500 font-bold text-xs mt-4 mb-2">
            ACCOUNTING
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {data.accounting.map((item) => {
                const isActive = pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive} className="h-10">
                      <Link href={item.url} className={isActive ? "font-medium text-blue-700" : "text-slate-600"}>
                        <item.icon className="mr-2 h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

         {/* GROUP 3: SYSTEM */}
         <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              {data.system.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="h-10">
                    <Link href={item.url}>
                      <item.icon className="mr-2 h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>
    </Sidebar>
  );
}