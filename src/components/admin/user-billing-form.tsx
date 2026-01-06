
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { updateUserBillingConfig } from '@/actions/admin-billing';
import { Settings, Loader2 } from 'lucide-react';

export function UserBillingForm({ user }: { user: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const [config, setConfig] = useState({
    subscriptionTier: user.billing?.subscriptionTier || 'free',
    baseFee: user.billing?.baseFee || 0,
    propertyRate: user.billing?.propertyRate || 0,
    transactionFeePercent: user.billing?.transactionFeePercent || 0,
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateUserBillingConfig(user.id, {
        ...config,
        baseFee: Number(config.baseFee),
        propertyRate: Number(config.propertyRate),
        transactionFeePercent: Number(config.transactionFeePercent),
      });
      toast({
        title: 'Billing Updated',
        description: `Settings saved for ${user.email}. The page will now refresh.`,
      });
      setIsOpen(false);
      // This is a client-side navigation, not a full reload.
      // It helps Next.js re-fetch server component data.
      window.location.reload();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Billing for {user.email}</DialogTitle>
          <DialogDescription>
            Override the default subscription settings for this user.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="tier" className="text-right">
              Tier
            </Label>
            <Select
              value={config.subscriptionTier}
              onValueChange={(value) => setConfig({ ...config, subscriptionTier: value })}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select Tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="baseFee" className="text-right">
              Base Fee ($)
            </Label>
            <Input
              id="baseFee"
              type="number"
              value={config.baseFee}
              onChange={(e) => setConfig({ ...config, baseFee: e.target.valueAsNumber || 0 })}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="propertyRate" className="text-right">
              Rate/Property
            </Label>
            <Input
              id="propertyRate"
              type="number"
              value={config.propertyRate}
              onChange={(e) => setConfig({ ...config, propertyRate: e.target.valueAsNumber || 0 })}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="txFee" className="text-right">
              Tx Fee (%)
            </Label>
            <Input
              id="txFee"
              type="number"
              value={config.transactionFeePercent}
              onChange={(e) => setConfig({ ...config, transactionFeePercent: e.target.valueAsNumber || 0 })}
              className="col-span-3"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
