'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/dashboard/stat-card';
import { 
    FileText, Send, CalendarCheck, FileStack, ShoppingCart, Building, Clock 
} from 'lucide-react';

const kpiData = [
    {
        title: "Ready to Collect",
        value: 1250.00,
        icon: <FileText className="h-6 w-6 text-yellow-500" />,
        description: "Total value of Draft & Unsent invoices"
    },
    {
        title: "Outstanding",
        value: 8750.00,
        icon: <Send className="h-6 w-6 text-orange-500" />,
        description: "Invoices sent but not yet paid"
    },
    {
        title: "Collected this Month",
        value: 21500.00,
        icon: <CalendarCheck className="h-6 w-6 text-green-500" />,
        description: "Total payments received this month"
    }
];

const actionCards = [
    {
        title: "Service Invoice",
        description: "For contractors, freelancers, and service providers. Create a standard invoice.",
        icon: <FileStack className="h-8 w-8 text-primary" />,
        buttonText: "Create Invoice",
        href: '#',
    },
    {
        title: "Product Sale",
        description: "For retail and e-commerce. Sell items from your inventory.",
        icon: <ShoppingCart className="h-8 w-8 text-primary" />,
        buttonText: "Create Sale",
        href: '#',
    },
    {
        title: "Rent Collection",
        description: "For landlords and property managers. Charge rent or set up recurring leases.",
        icon: <Building className="h-8 w-8 text-primary" />,
        buttonText: "Create Charge",
        href: '/dashboard/sales/rent-collection',
    },
    {
        title: "Time Tracking",
        description: "For attorneys, consultants, and agencies. Bill by the hour for projects.",
        icon: <Clock className="h-8 w-8 text-primary" />,
        buttonText: "Create Bill",
        href: '#',
    }
];

export default function SalesHubPage() {
  return (
    <div className="flex flex-col gap-8 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Sales & Collections</h1>
        <p className="text-muted-foreground">Create invoices, track payments, and manage your sales workflow.</p>
      </div>

      {/* KPI Section */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {kpiData.map(kpi => (
            <StatCard
                key={kpi.title}
                title={kpi.title}
                value={kpi.value}
                icon={kpi.icon}
                description={kpi.description}
            />
        ))}
      </div>

      {/* Action Cards Section */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {actionCards.map(card => (
          <Link key={card.title} href={card.href} passHref>
            <Card className="flex flex-col shadow-lg hover:shadow-xl transition-shadow h-full cursor-pointer">
                <CardHeader className="flex-row items-center gap-4 space-y-0">
                   {card.icon}
                   <CardTitle>{card.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex-1">
                    <CardDescription>{card.description}</CardDescription>
                </CardContent>
                <CardFooter>
                    <Button className="w-full">{card.buttonText}</Button>
                </CardFooter>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
