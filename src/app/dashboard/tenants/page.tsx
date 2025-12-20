'use client';

import { useState } from 'react';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, UserPlus, Users } from 'lucide-react';
import { InviteTenantModal } from '@/components/tenants/InviteTenantModal';

export default function TenantsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  // This query will find all users who are tenants linked to the current landlord.
  const tenantsQuery = useCollection(
    user && firestore ? query(collection(firestore, 'users'), where('landlordId', '==', user.uid), where('role', '==', 'tenant')) : null
  );

  return (
    <>
      <div className="space-y-8 p-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">All Tenants</h1>
            <p className="text-muted-foreground">Manage all residents across your properties.</p>
          </div>
          <Button onClick={() => setIsInviteOpen(true)} className="gap-2">
            <UserPlus className="h-4 w-4" /> Invite New Tenant
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Rent Amount</TableHead>
                  <TableHead>Property</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenantsQuery.isLoading ? (
                  <TableRow><TableCell colSpan={4} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground"/></TableCell></TableRow>
                ) : tenantsQuery.data && tenantsQuery.data.length > 0 ? (
                  tenantsQuery.data.map((tenant: any) => (
                    <TableRow key={tenant.id}>
                      <TableCell className="font-medium">{tenant.email}</TableCell>
                      <TableCell className="capitalize">{tenant.status}</TableCell>
                      <TableCell>${(tenant.billing?.rentAmount || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {/* Placeholder for property name - needs another query to resolve */}
                        {tenant.associatedPropertyId.slice(0, 8)}...
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No tenants found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {user && (
        <InviteTenantModal
          isOpen={isInviteOpen}
          onOpenChange={setIsInviteOpen}
          landlordId={user.uid}
        />
      )}
    </>
  );
}
