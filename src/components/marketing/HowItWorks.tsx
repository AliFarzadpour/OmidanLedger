
import { Separator } from '@/components/ui/separator';

const steps = [
  {
    number: '01',
    title: 'Add Your Properties',
    description: 'Quickly enter your property details. Our system generates a full chart of accounts for each property automatically.',
  },
  {
    number: '02',
    title: 'Connect Your Banks',
    description: 'Securely link your bank and credit card accounts in seconds using Plaid. Transactions are fetched and ready for categorization.',
  },
  {
    number: '03',
    title: 'Review & Confirm',
    description: 'Our AI suggests categories for your transactions. Just review and confirm. The system learns your habits, getting smarter over time.',
  },
  {
    number: '04',
    title: 'Get Real-Time Reports',
    description: 'Your dashboard is always up-to-date. Instantly see your Profit & Loss, cash flow, and other key metrics for any property or the whole portfolio.',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 md:py-32 bg-slate-50/70">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Setup in 15 Minutes</h2>
          <p className="text-lg text-slate-600">
            Go from scattered bank statements to a complete financial picture of your portfolio faster than you can find your spreadsheet password.
          </p>
        </div>
        <div className="relative">
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-200 hidden md:block" aria-hidden="true" />
          <div className="space-y-16">
            {steps.map((step, index) => (
              <div
                key={step.title}
                className="grid md:grid-cols-2 gap-8 items-center"
              >
                <div className={`md:text-right ${index % 2 === 1 ? 'md:order-2' : ''}`}>
                  <h3 className="text-8xl font-black text-slate-200">{step.number}</h3>
                  <h4 className="text-2xl font-bold mt-2">{step.title}</h4>
                  <p className="text-slate-600 mt-2 max-w-sm md:ml-auto">{step.description}</p>
                </div>
                <div className={`aspect-video bg-slate-200 rounded-lg shadow-md ${index % 2 === 1 ? 'md:order-1' : ''}`}>
                    {/* Placeholder for image/animation */}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
