'use client';

import { BusinessProfileForm } from '@/components/dashboard/settings/business-profile-form';
import { AccountSettingsForm } from '@/components/dashboard/settings/account-settings-form';
import { Separator } from '@/components/ui/separator';
import { AdminPublishButton } from '@/components/dashboard/settings/admin-publish-button';
import { PaymentSettingsForm } from '@/components/dashboard/settings/payment-settings-form';

export default function SettingsPage() {
  return (
    <div className="space-y-6 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your business profile, account, and application settings.
        </p>
      </div>
      <Separator />
      <BusinessProfileForm />
      <Separator />
      <PaymentSettingsForm />
      <Separator />
      <AccountSettingsForm />
      
      {/* Admin-only section */}
      <AdminPublishButton />
    </div>
  );
}
