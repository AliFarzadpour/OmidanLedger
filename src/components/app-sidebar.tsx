
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
  LayoutDashboard,
  BrainCircuit,
  ShieldCheck, // New Icon for Admin
  Activity, // New Icon for Health
  BookOpenCheck, // Icon for Onboarding
  DollarSign, // Icon for Billing
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
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useUser, useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { isSuperAdmin } from "@/lib/auth-utils";
import { Logo } from "@/components/logo";
import { collection, query, where } from "firebase/firestore";
import { cn } from "@/lib/utils";

const data = {
  // Zone 1: The "Physical" World (Real Estate)
  realEstate: [
    {
      title: "Properties",
      url: "/dashboard/properties",
      icon: Building2,
      advanced: false,
    },
    {
      title: "Revenue Center",
      url: "/dashboard/sales",
      icon: LayoutDashboard,
      advanced: true,
    },
    {
      title: "Debt Center",
      url: "/dashboard/sales/debt-center",
      icon: Landmark,
      advanced: true,
    },
  ],
  
  // Zone 2: The "Money" World (Bookkeeping)
  accounting: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: LayoutDashboard,
      advanced: false,
    },
    {
      title: "Transactions",
      url: "/dashboard/transactions",
      icon: CreditCard,
      advanced: true,
    },
    {
      title: "Onboarding",
      url: "/dashboard/onboarding/opening-balances",
      icon: BookOpenCheck,
      advanced: false,
    },
    {
      title: "Invoices & Billing",
      url: "/dashboard/sales/services",
      icon: FileText,
      advanced: true,
    },
    {
      title: "Vendors",
      url: "/dashboard/vendors",
      icon: Users,
      advanced: true,
    },
    {
      title: "Smart Rules",
      url: "/dashboard/rules",
      icon: BrainCircuit,
      advanced: true,
    },
    {
      title: "Reports",
      url: "/dashboard/reports",
      icon: PieChart,
      advanced: true,
    },
  ],
  
  // NEW: Zone 4: Admin
  admin: [
    {
      title: "Admin Dashboard",
      url: "/admin",
      icon: ShieldCheck,
      advanced: false,
    },
    {
      title: "User Management",
      url: "/admin/users",
      icon: Users,
      advanced: false,
    },
    {
      title: "Billing",
      url: "/admin/billing",
      icon: DollarSign,
      advanced: false,
    },
    {
      title: "System Health",
      url: "/admin/health",
      icon: Activity,
      advanced: false,
    }
  ],

  // Zone 3: System
  system: [
    {
      title: "Settings",
      url: "/dashboard/settings",
      icon: Settings,
      advanced: false,
    },
  ]
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useUser();
  const firestore = useFirestore();
  const [isAdmin, setIsAdmin] = React.useState(false);

  // Check if user has properties to determine if they are still in setup mode
  const propertiesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'properties'), where('userId', '==', user.uid));
  }, [user, firestore]);
  const { data: properties } = useCollection(propertiesQuery);
  const inSetupMode = !properties || properties.length === 0;

  React.useEffect(() => {
    if (user?.uid) {
      isSuperAdmin(user.uid).then(setIsAdmin);
    }
  }, [user]);

  const renderMenuItem = (item: any) => {
    const isActive = item.url === '/dashboard' 
      ? pathname === item.url 
      : pathname.startsWith(item.url);
    
    const isDisabled = inSetupMode && item.advanced;

    const button = (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton 
          isActive={isActive} 
          onClick={() => !isDisabled && router.push(item.url)} 
          disabled={isDisabled}
          className={cn('h-10 mb-1 transition-all', 
            isActive ? "bg-white shadow-sm font-medium text-blue-700 border border-slate-100" : "text-slate-600 hover:bg-white/50",
            isDisabled && "opacity-60 cursor-not-allowed hover:bg-transparent"
          )}
        >
          <item.icon className={cn('mr-2 h-4 w-4', isActive ? 'text-blue-600' : 'text-slate-400', isDisabled && 'text-slate-300')} />
          <span>{item.title}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );

    if (isDisabled) {
      return (
        <Tooltip key={item.title}>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side="right"><p>Available after setup</p></TooltipContent>
        </Tooltip>
      )
    }

    return button;
  }

  return (
    <Sidebar variant="inset" className="border-r bg-white" {...props}>
      <SidebarHeader className="h-16 flex items-center px-4 border-b bg-white mb-2">
        <Logo />
      </SidebarHeader>

      <SidebarContent className="bg-slate-50/50 px-2">
        
        {/* GROUP 1: REAL ESTATE */}
        <SidebarGroup>
          <SidebarGroupLabel className="tracking-widest text-slate-500 font-bold text-xs mt-2 mb-3 px-2">
            REAL ESTATE
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {data.realEstate.map(renderMenuItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* GROUP 2: ACCOUNTING */}
        <SidebarGroup>
          <SidebarGroupLabel className="tracking-widest text-slate-500 font-bold text-xs mt-8 mb-3 px-2">
            ACCOUNTING
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {data.accounting.map(renderMenuItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        {/* NEW: ADMIN GROUP (CONDITIONAL) */}
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="tracking-widest text-red-500 font-bold text-xs mt-8 mb-3 px-2">
              SUPER ADMIN
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {data.admin.map(renderMenuItem)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* SYSTEM GROUP */}
        <SidebarGroup className="mt-auto pb-4">
          <SidebarGroupContent>
            <SidebarMenu>
              {data.system.map(renderMenuItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>
    </Sidebar>
  );
}
