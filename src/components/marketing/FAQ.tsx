
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const faqs = [
  {
    question: 'Is my bank information secure?',
    answer:
      "Yes. We use Plaid to connect to your bank accounts. We never see, store, or have access to your bank login credentials. Your data is encrypted and transmitted securely via Plaid's established and trusted infrastructure.",
  },
  {
    question: "Do you have read-only access to my bank accounts?",
    answer:
      "Correct. OmidanLedger only has read-only access to your transaction data. We cannot move money, make payments, or perform any actions in your bank account. Our sole purpose is to import and analyze your transaction history.",
  },
  {
    question: 'Can I use this for my personal finances?',
    answer:
      'While you could, OmidanLedger is specifically designed for real estate investors. Our categorization, reporting, and dashboard metrics are all tailored to the unique needs of property owners.',
  },
  {
    question: 'What happens after the 6-month free early access period?',
    answer:
      "As an early user, you'll have the option to subscribe to a paid plan at a 50% lifetime discount. There is no obligation, and you can export your data at any time. We will never automatically charge you.",
  },
];

export function FAQ() {
  return (
    <section id="faq" className="py-20 md:py-32 bg-slate-50/70">
      <div className="container mx-auto px-4 md:px-6 max-w-3xl">
        <div className="text-center space-y-4 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Frequently Asked Questions</h2>
        </div>
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger className="text-lg text-left">{faq.question}</AccordionTrigger>
              <AccordionContent className="text-base text-slate-600">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
