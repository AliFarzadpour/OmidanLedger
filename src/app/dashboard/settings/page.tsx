'use client';

import { BusinessProfileForm } from '@/components/dashboard/settings/business-profile-form';
import { Separator } from '@/components/ui/separator';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your business profile, account, and application settings.
        </p>
      </div>
      <Separator />
      <BusinessProfileForm />
    </div>
  );
}
