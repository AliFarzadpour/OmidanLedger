import Image from 'next/image';

const steps = [
  {
    number: '01',
    title: 'Add Your Properties',
    description: 'Enter basic property details. OmidanLedger automatically sets up rental-ready categories.',
  },
  {
    number: '02',
    title: 'Connect Your Banks',
    description: 'Securely link your bank and credit card accounts in seconds using Plaid.',
  },
  {
    number: '03',
    title: 'Review & Confirm',
    description: 'Transactions are pre-categorized for you. Review and approve — the system adapts to your preferences over time.',
  },
  {
    number: '04',
    title: 'Get Real-Time Reports',
    description: 'Your dashboard stays up to date. Instantly view P&L, cash flow, and performance by property or portfolio.',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 md:py-32 bg-slate-50/70">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Set Up in 15 Minutes</h2>
          <p className="text-lg text-slate-600">
            Go from scattered bank statements to a clear financial picture faster than finding your old spreadsheet password.
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
                <div className={`aspect-video bg-slate-200 rounded-lg shadow-md overflow-hidden ${index % 2 === 1 ? 'md:order-1' : ''}`}>
                  {index === 0 ? (
                    <Image
                      src="https://firebasestorage.googleapis.com/v0/b/studio-7576922301-bac28.firebasestorage.app/o/logos%2FAdding%20properties.png?alt=media&token=4d490e9f-ec2a-4467-8401-4d61d398161c"
                      alt="A screenshot showing how to add properties in OmidanLedger."
                      width={800}
                      height={450}
                      className="rounded-lg shadow-md object-cover w-full h-full"
                    />
                  ) : (
                    // Placeholder for other images/animations
                    <div className="w-full h-full" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
