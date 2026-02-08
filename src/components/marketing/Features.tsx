import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, FileText, ShieldCheck, CreditCard, BadgeCheck, BarChart2 } from 'lucide-react';

const featureList = [
  {
    icon: <CreditCard className="h-8 w-8 text-primary" />,
    title: 'Automated Bookkeeping',
    description: 'Securely connect your bank and credit card accounts using Plaid. Transactions are imported and categorized automatically — no manual entry.',
  },
  {
    icon: <Building2 className="h-8 w-8 text-primary" />,
    title: 'Portfolio-Level View',
    description: "See income, expenses, and NOI across all properties in one place. Understand your entire portfolio at a glance.",
  },
  {
    icon: <FileText className="h-8 w-8 text-primary" />,
    title: 'Tax-Ready Reports',
    description: 'Generate Profit & Loss, cash flow, and Schedule E summaries in one click. Tax time without the scramble.',
  },
  {
    icon: <ShieldCheck className="h-8 w-8 text-primary" />,
    title: 'Bank-Level Security',
    description: "Plaid provides read-only access. We never see or store your bank credentials.",
  },
];

export function Features() {
  return (
    <section id="features" className="py-20 md:py-32">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-12">
          <BadgeCheck className="h-10 w-10 text-primary mx-auto" />
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Built for Landlords — Not Accountants</h2>
          <p className="text-lg text-slate-600">
            OmidanLedger focuses on the metrics that matter to real estate investors. Less accounting jargon. More clarity, control, and confidence.
          </p>
          <div className="p-4 bg-slate-50 border rounded-lg">
             <div className="flex items-center justify-center gap-2 font-semibold text-slate-700">
                <BarChart2 className="h-5 w-5 text-primary" />
                <span>Metrics Highlight:</span>
             </div>
             <p className="text-sm text-slate-500 mt-2">
                Cash Flow • NOI • Income vs Expenses • Per-Property Performance • Schedule E Categories
             </p>
          </div>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-2 gap-8">
          {featureList.map((feature) => (
            <Card key={feature.title} className="text-center shadow-sm hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="mx-auto w-fit bg-primary/10 p-4 rounded-full mb-4">
                  {feature.icon}
                </div>
                <CardTitle className="text-xl">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
