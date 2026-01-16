'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import AcceptInviteForm from '@/components/tenant/AcceptInviteForm';

export default function TenantAcceptPage() {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin text-primary" />}>
                <AcceptInviteForm />
            </Suspense>
        </div>
    )
}
