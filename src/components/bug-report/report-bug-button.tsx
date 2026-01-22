'use client';

import { useState } from 'react';
import html2canvas from 'html2canvas';
import { Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { reportBug } from '@/actions/report-bug-action';
import { Loader2 } from 'lucide-react';

export function ReportBugButton() {
  const { user } = useUser();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [notes, setNotes] = useState('');

  const handleReport = async () => {
    if (!user) {
      toast({ variant: 'destructive', title: 'You must be logged in to report a bug.' });
      return;
    }
    setIsSending(true);
    
    try {
      // Hide the dialog itself during screenshot
      const dialogElement = document.querySelector('[role="dialog"]');
      if (dialogElement) (dialogElement as HTMLElement).style.display = 'none';

      const canvas = await html2canvas(document.body, {
        useCORS: true, // This helps with loading cross-origin images if any
        logging: false, // Turn off extensive console logging
      });
      const screenshotDataUrl = canvas.toDataURL('image/png');
      
      // Show the dialog again
      if (dialogElement) (dialogElement as HTMLElement).style.display = '';

      await reportBug({
        screenshotDataUrl,
        userEmail: user.email || 'unknown@user.com',
        notes,
        pageUrl: window.location.href,
      });

      toast({
        title: 'Bug Report Sent!',
        description: 'Thank you for your feedback. We will look into it shortly.',
      });
      setIsOpen(false);
      setNotes('');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to Send Report',
        description: error.message,
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="w-full justify-start text-slate-600 hover:text-slate-900 hover:bg-white/50">
          <Bug className="mr-2 h-4 w-4" />
          <span>Report a Bug</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report a Bug</DialogTitle>
          <DialogDescription>
            Found something that's not working right? Please let us know. A screenshot of the page will be automatically included.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Label htmlFor="bug-notes">Notes (optional)</Label>
          <Textarea
            id="bug-notes"
            placeholder="Describe what you were doing when the bug occurred..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button onClick={handleReport} disabled={isSending}>
            {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Send Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
