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
      "Yes. We use Plaid with bank-level encryption and read-only access.",
  },
  {
    question: "Do you have access to my bank accounts?",
    answer:
      "No. We cannot move money or make changes. Access is read-only.",
  },
  {
    question: 'Is this for personal finances?',
    answer:
      'No. OmidanLedger is built specifically for rental property bookkeeping.',
  },
   {
    question: 'Does this support multiple properties and LLCs?',
    answer:
      'Yes. Early access includes unlimited properties and bank connections.',
  },
  {
    question: 'Can I export reports for my CPA?',
    answer:
      'Yes. You can export P&L, cash flow, and Schedule E summaries.',
  },
  {
    question: 'What happens after the 6-month early access period?',
    answer:
      "You can continue using OmidanLedger with a 50% lifetime founding-member discount.",
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
