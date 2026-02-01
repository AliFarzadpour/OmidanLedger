
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, FileText, ShieldCheck, Sparkles, CreditCard, BadgeCheck } from 'lucide-react';

const featureList = [
  {
    icon: <CreditCard className="h-8 w-8 text-primary" />,
    title: 'Automated Bookkeeping',
    description: 'Securely link your bank accounts with Plaid. Transactions are automatically imported and categorized, saving you hours of manual data entry.',
  },
  {
    icon: <Building2 className="h-8 w-8 text-primary" />,
    title: 'Portfolio-Level View',
    description: "Finally, a single dashboard for your entire portfolio's performance. Track income, expenses, and NOI across all your properties.",
  },
  {
    icon: <FileText className="h-8 w-8 text-primary" />,
    title: 'Tax-Ready Reports',
    description: 'Generate Profit & Loss statements, cash flow reports, and Schedule E summaries with one click. Make tax time a breeze.',
  },
  {
    icon: <ShieldCheck className="h-8 w-8 text-primary" />,
    title: 'Bank-Level Security',
    description: "We use Plaid to link your accounts, meaning we never see or store your bank credentials. Your data is protected with read-only access.",
  },
];

export function Features() {
  return (
    <section id="features" className="py-20 md:py-32">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-12">
          <BadgeCheck className="h-10 w-10 text-primary mx-auto" />
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Built for Landlords, Not Accountants</h2>
          <p className="text-lg text-slate-600">
            We focus on the metrics that matter for real estate investors. Less accounting jargon, more actionable insights.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
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
