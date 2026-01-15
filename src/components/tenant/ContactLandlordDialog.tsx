'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { sendTenantMessage } from '@/actions/tenant-actions';
import { Loader2, MessageSquare } from 'lucide-react';

interface ContactLandlordDialogProps {
  userId: string;
  landlordId: string;
  propertyId: string;
  unitId?: string | null;
  tenantName: string;
  tenantEmail: string;
}

export function ContactLandlordDialog({ userId, landlordId, propertyId, unitId, tenantName, tenantEmail }: ContactLandlordDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    subject: '',
    body: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.subject || !formData.body) {
      toast({
        variant: 'destructive',
        title: 'Missing Fields',
        description: 'Please provide both a subject and a message.',
      });
      return;
    }
    setIsLoading(true);
    try {
      await sendTenantMessage({
        userId,
        landlordId,
        propertyId,
        unitId: unitId || undefined,
        threadSubject: formData.subject,
        messageBody: formData.body,
        senderName: tenantName,
        senderEmail: tenantEmail,
      });

      toast({
        title: 'Message Sent!',
        description: 'Your landlord has been notified.',
      });
      setIsOpen(false);
      setFormData({ subject: '', body: '' }); // Reset form
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to Send Message',
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="w-full">
            <MessageSquare className="mr-2 h-4 w-4"/>
            Send a Message or Request
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Contact Your Landlord</DialogTitle>
          <DialogDescription>
            Use this form for maintenance requests, questions, or other communication.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              name="subject"
              placeholder="e.g., Leaky faucet in kitchen"
              value={formData.subject}
              onChange={handleChange}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="body">Message</Label>
            <Textarea
              id="body"
              name="body"
              placeholder="Please provide details about your request..."
              value={formData.body}
              onChange={handleChange}
              className="min-h-[120px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send Message
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
