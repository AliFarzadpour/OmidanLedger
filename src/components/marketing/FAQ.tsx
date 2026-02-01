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
      "Yes. Bank connections use Plaid with read-only access.",
  },
  {
    question: "Do you have access to my bank accounts?",
    answer:
      "No. We never see or store your credentials.",
  },
  {
    question: 'Is this for personal finances?',
    answer:
      'No. OmidanLedger is built specifically for rental property bookkeeping.',
  },
  {
    question: 'What happens after the 6-month early access period?',
    answer:
      "Early users will receive preferred pricing and advance notice before any paid plans begin.",
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
