
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';

const testimonials = [
  {
    name: 'Sarah L.',
    role: 'Landlord, 4 Properties',
    text: '"I used to spend a whole weekend every quarter catching up on my books. OmidanLedger gave me my weekends back. Now I know my exact P&L in real-time."',
    avatar: 'https://i.pravatar.cc/150?img=1',
  },
  {
    name: 'David R.',
    role: 'Real Estate Investor',
    text: '"The AI categorization is a game-changer. What took hours now takes minutes. It\'s surprisingly accurate and gets smarter the more I use it."',
    avatar: 'https://i.pravatar.cc/150?img=3',
  },
  {
    name: 'Maria G.',
    role: 'Property Manager',
    text: '"This is the first tool I\'ve found that understands real estate accounting without being overly complicated. It\'s powerful but simple."',
    avatar: 'https://i.pravatar.cc/150?img=5',
  },
];

export function Testimonials() {
  return (
    <section className="py-20 md:py-32">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Loved by Landlords Like You</h2>
          <p className="text-lg text-slate-600">
            Don't just take our word for it. Hear from real estate investors who have transformed their financial workflow.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial) => (
            <Card key={testimonial.name} className="flex flex-col">
              <CardContent className="p-6 flex-1">
                <blockquote className="text-lg text-slate-700">“{testimonial.text}”</blockquote>
              </CardContent>
              <div className="bg-slate-50/70 p-4 border-t flex items-center gap-4">
                <Avatar>
                  <AvatarImage src={testimonial.avatar} alt={testimonial.name} />
                  <AvatarFallback>{testimonial.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{testimonial.name}</p>
                  <p className="text-sm text-slate-500">{testimonial.role}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
