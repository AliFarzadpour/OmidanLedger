'use client';

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Building2,
  Users,
  CreditCard,
  FileText,
  PieChart,
  Settings,
  Landmark,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from "@/components/ui/sidebar";

const data = {
  realEstate: [
    { title: "Properties", url: "/dashboard/properties", icon: Building2 },
    { title: "Tenants", url: "/dashboard/properties?view=tenants", icon: Users },
  ],
  accounting: [
    { title: "Transactions", url: "/dashboard/transactions", icon: CreditCard },
    { title: "Invoices & Billing", url: "/dashboard/sales", icon: FileText },
    { title: "Reports", url: "/dashboard/reports", icon: PieChart },
  ],
  system: [
    { title: "Settings", url: "/dashboard/settings", icon: Settings },
  ]
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <Sidebar variant="inset" className="border-r bg-white" {...props}>
      {/* 1. Header Spacing: Added 'mb-4' to push content down */}
      <SidebarHeader className="h-16 flex items-center px-6 border-b bg-white mb-2">
        <div className="flex items-center gap-2 font-bold text-xl text-slate-900">
          <Landmark className="h-6 w-6 text-blue-600" />
          <span>FiscalFlow</span>
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-slate-50/50 px-2"> {/* Added horizontal padding px-2 */}
        
        {/* REAL ESTATE GROUP */}
        <SidebarGroup>
          <SidebarGroupLabel className="tracking-widest text-slate-500 font-bold text-xs mt-2 mb-3 px-2">
            REAL ESTATE
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {data.realEstate.map((item) => {
                const isActive = pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      isActive={isActive} 
                      onClick={() => router.push(item.url)} 
                      className={`h-10 mb-1 ${isActive ? "bg-white shadow-sm font-medium text-blue-700 border border-slate-100" : "text-slate-600 hover:bg-white/50"}`}
                    >
                      <item.icon className={`mr-2 h-4 w-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ACCOUNTING GROUP */}
        <SidebarGroup>
          {/* 2. Group Spacing: Increased to 'mt-8' for clear separation */}
          <SidebarGroupLabel className="tracking-widest text-slate-500 font-bold text-xs mt-8 mb-3 px-2">
            ACCOUNTING
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {data.accounting.map((item) => {
                const isActive = pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      isActive={isActive} 
                      onClick={() => router.push(item.url)} 
                      className={`h-10 mb-1 ${isActive ? "bg-white shadow-sm font-medium text-blue-700 border border-slate-100" : "text-slate-600 hover:bg-white/50"}`}
                    >
                      <item.icon className={`mr-2 h-4 w-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* SYSTEM GROUP */}
        <SidebarGroup className="mt-auto pb-4">
          <SidebarGroupContent>
            <SidebarMenu>
              {data.system.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    onClick={() => router.push(item.url)} 
                    className="h-10 text-slate-600 hover:bg-white/50"
                  >
                    <item.icon className="mr-2 h-4 w-4 text-slate-400" />
                    <span>{item.title}</span>
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