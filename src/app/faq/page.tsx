
import { Header } from '@/components/marketing/Header';
import { Footer } from '@/components/marketing/Footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'FAQ | OmidanLedger',
    description: 'Find answers to frequently asked questions about security, pricing, and our early access program.',
};

const faqs = [
  {
    question: 'Is my bank information secure?',
    answer:
      "Yes. We use Plaid to connect to your financial institutions, which means we never see or store your bank login credentials. All data is transmitted over encrypted connections, and our platform is built on Google's secure cloud infrastructure.",
  },
  {
    question: "Do you have access to my bank accounts?",
    answer:
      "No. The connection we establish through Plaid is read-only. We can only view transaction data to automate your bookkeeping. We have no ability to move money, make payments, or perform any actions in your accounts.",
  },
  {
    question: 'Is this for personal finances?',
    answer:
      'No. OmidanLedger is designed from the ground up for real estate investors and landlords. Our features, reports, and categorization logic are all tailored to the specific needs of managing rental properties.',
  },
  {
    question: 'What happens after the 6-month early access period?',
    answer:
      "As a thank you for helping us improve the product, all early users will receive a lifetime 50% discount on any future paid plan. We will provide ample notice and clear details before any billing begins.",
  },
];


export default function FAQPage() {
  return (
    <div className="bg-slate-50 min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 py-20 px-4">
        <div className="container mx-auto max-w-3xl">
          <Card className="shadow-lg">
            <CardHeader className="text-center p-8">
              <CardTitle className="text-4xl font-bold tracking-tight text-slate-900">
                Frequently Asked Questions
              </CardTitle>
            </CardHeader>
            <CardContent className="px-8 pb-8">
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

              <div className="text-center pt-10 mt-6 border-t">
                <p className="text-muted-foreground">
                  Questions? Email us at <a href="mailto:support@omidanledger.com" className="text-primary font-medium hover:underline">support@omidanledger.com</a>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
